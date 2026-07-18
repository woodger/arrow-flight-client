import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Message,
  RecordBatchReader,
  Table,
  tableFromArrays
} from 'apache-arrow';
import { decodeFlightData, encodeFlightData, FlightProtocolError } from './ipc';
import { encodeDescriptor } from './protocol';
import { pathDescriptor } from './types';
import type { FlightData } from '../generated/Flight';

describe('Flight IPC adapter', () => {
  test('round-trips schema and batches through FlightData framing', async () => {
    const expected = tableFromArrays({ id: [1, 2], active: [true, false] });
    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('example')),
      expected
    )) {
      messages.push(message);
    }

    assert.ok(Message.decode(messages[0]?.dataHeader ?? []).isSchema());
    assert.ok(messages.some(({ dataHeader }) => (
      Message.decode(dataHeader).isRecordBatch()
    )));
    assert.ok(messages.every(({ dataHeader }) => dataHeader.byteLength !== 0));

    const reader = await RecordBatchReader.from(
      decodeFlightData(asAsync(messages), () => undefined)
    );
    const batches = [];

    for await (const batch of reader) {
      batches.push(batch);
    }

    const actual = new Table(reader.schema, batches);
    assert.deepStrictEqual(actual.toArray(), expected.toArray());
  });

  test('rejects a body whose size differs from its IPC header', async () => {
    const table = tableFromArrays({ id: [1] });
    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('example')),
      table
    )) {
      messages.push(message);
    }

    const batch = messages.find(({ dataHeader }) => (
      Message.decode(dataHeader).isRecordBatch()
    ));
    assert.ok(batch);
    batch.dataBody = Buffer.alloc(0);

    await assert.rejects(
      async () => {
        for await (const unused of decodeFlightData(asAsync(messages), () => undefined)) {
          void unused;
        }
      },
      FlightProtocolError
    );
  });

  test('streams multiple dictionary batches under one schema', async () => {
    const table = tableFromArrays({ name: ['one', 'two'] });
    const batch = table.batches[0];

    assert.ok(batch);
    const firstBatch = batch.slice(0, 1);
    const secondBatch = batch.slice(1, 2);

    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('example')),
      asAsync([firstBatch, secondBatch])
    )) {
      messages.push(message);
    }

    const schemaCount = messages.filter(({ dataHeader }) => (
      Message.decode(dataHeader).isSchema()
    )).length;
    const batchCount = messages.filter(({ dataHeader }) => (
      Message.decode(dataHeader).isRecordBatch()
    )).length;

    assert.strictEqual(schemaCount, 1);
    assert.strictEqual(batchCount, 2);
    assert.ok(messages.slice(1).every(({ flightDescriptor }) => !flightDescriptor));

    const reader = await RecordBatchReader.from(
      decodeFlightData(asAsync(messages), () => undefined)
    );
    const batches = [];

    for await (const batch of reader) {
      batches.push(batch);
    }

    const actual = new Table(reader.schema, batches);
    assert.deepStrictEqual(actual.getChild('name')?.toArray(), ['one', 'two']);
  });

  test('writes the provided schema for an empty iterable', async () => {
    const table = tableFromArrays({ id: [1] });
    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('empty')),
      asAsync([]),
      { schema: table.schema }
    )) {
      messages.push(message);
    }

    assert.strictEqual(messages.length, 1);
    assert.ok(Message.decode(messages[0]?.dataHeader ?? []).isSchema());
  });
});

async function* asAsync<T>(values: Iterable<T>): AsyncIterable<T> {
  yield* values;
}
