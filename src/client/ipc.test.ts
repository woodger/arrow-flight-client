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

  test('writes application metadata separately after the schema', async () => {
    const table = tableFromArrays({ id: [1] });
    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('metadata')),
      table,
      { appMetadata: Buffer.from('manifest') }
    )) {
      messages.push(message);
    }

    const schemaMessage = messages[0];
    const metadataMessage = messages[1];

    assert.ok(schemaMessage);
    assert.ok(metadataMessage);
    assert.ok(Message.decode(schemaMessage.dataHeader).isSchema());
    assert.deepStrictEqual(schemaMessage.flightDescriptor?.path, ['metadata']);
    assert.strictEqual(schemaMessage.appMetadata.byteLength, 0);
    assert.strictEqual(metadataMessage.flightDescriptor, undefined);
    assert.strictEqual(metadataMessage.dataHeader.byteLength, 0);
    assert.strictEqual(metadataMessage.dataBody.byteLength, 0);
    assert.strictEqual(metadataMessage.appMetadata.toString(), 'manifest');
    assert.ok(messages.slice(2).some(({ dataHeader }) => (
      Message.decode(dataHeader).isRecordBatch()
    )));
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

  test('writes application metadata for an empty iterable', async () => {
    const table = tableFromArrays({ id: [1] });
    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('empty')),
      asAsync([]),
      {
        schema: table.schema,
        appMetadata: Buffer.from('empty-manifest')
      }
    )) {
      messages.push(message);
    }

    assert.strictEqual(messages.length, 2);
    assert.ok(Message.decode(messages[0]?.dataHeader ?? []).isSchema());
    assert.strictEqual(messages[1]?.dataHeader.byteLength, 0);
    assert.strictEqual(messages[1]?.dataBody.byteLength, 0);
    assert.strictEqual(
      messages[1]?.appMetadata.toString(),
      'empty-manifest'
    );
  });

  test('does not write an empty metadata-only message', async () => {
    const table = tableFromArrays({ id: [1] });
    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('empty-metadata')),
      table,
      { appMetadata: new Uint8Array(0) }
    )) {
      messages.push(message);
    }

    assert.ok(messages.every(({ dataHeader }) => dataHeader.byteLength !== 0));
  });
});

async function* asAsync<T>(values: Iterable<T>): AsyncIterable<T> {
  yield* values;
}
