import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Message, tableFromArrays } from 'apache-arrow';
import { createFlightStreamReader } from './flight-stream-reader';
import { encodeFlightData } from './ipc';
import { encodeDescriptor } from './protocol';
import { pathDescriptor } from './types';
import type { FlightData } from '../generated/Flight';

describe('Flight stream reader integration', () => {
  test('keeps batch and metadata-only messages in stream order', async () => {
    const table = tableFromArrays({ id: [1, 2] });
    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('example')),
      table
    )) {
      if (Message.decode(message.dataHeader).isRecordBatch()) {
        message.appMetadata = Buffer.from('batch');
      }
      messages.push(message);
    }
    messages.push({
      flightDescriptor: undefined,
      dataHeader: Buffer.alloc(0),
      dataBody: Buffer.alloc(0),
      appMetadata: Buffer.from('trailing')
    });

    const reader = await createFlightStreamReader(
      asAsync(messages),
      () => undefined
    );
    const chunks = [];

    for await (const chunk of reader) {
      chunks.push(chunk);
    }

    assert.strictEqual(chunks[0]?.data?.numRows, 2);
    assert.strictEqual(Buffer.from(chunks[0]?.appMetadata ?? []).toString(), 'batch');
    assert.strictEqual(chunks[1]?.data, null);
    assert.strictEqual(Buffer.from(chunks[1]?.appMetadata ?? []).toString(), 'trailing');
  });

  test('yields metadata while the next record batch is pending', async () => {
    const table = tableFromArrays({ id: [1] });
    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('example')),
      table
    )) {
      messages.push(message);
    }

    const schema = messages.find(({ dataHeader }) => (
      Message.decode(dataHeader).isSchema()
    ));
    const batch = messages.find(({ dataHeader }) => (
      Message.decode(dataHeader).isRecordBatch()
    ));

    assert.ok(schema);
    assert.ok(batch);

    let releaseBatch: (() => void) | undefined;
    let markBatchPending: (() => void) | undefined;
    const batchReleased = new Promise<void>((resolve) => {
      releaseBatch = resolve;
    });
    const batchPending = new Promise<void>((resolve) => {
      markBatchPending = resolve;
    });
    const source = async function* (): AsyncIterable<FlightData> {
      yield schema;
      yield {
        flightDescriptor: undefined,
        dataHeader: Buffer.alloc(0),
        dataBody: Buffer.alloc(0),
        appMetadata: Buffer.from('before-batch')
      };
      markBatchPending?.();
      await batchReleased;
      yield batch;
    };
    const reader = await createFlightStreamReader(source(), () => undefined);
    const iterator = reader[Symbol.asyncIterator]();
    const metadataChunk = iterator.next();
    await batchPending;
    const blocked = Symbol('blocked');
    const firstResult = await Promise.race([
      metadataChunk,
      new Promise<typeof blocked>((resolve) => {
        setImmediate(() => resolve(blocked));
      })
    ]);

    releaseBatch?.();

    try {
      assert.notStrictEqual(firstResult, blocked);
      assert.notStrictEqual(firstResult, undefined);

      if (firstResult !== blocked) {
        assert.strictEqual(firstResult.done, false);
        assert.strictEqual(firstResult.value?.data, null);
        assert.strictEqual(
          Buffer.from(firstResult.value?.appMetadata ?? []).toString(),
          'before-batch'
        );
      }
    }
    finally {
      await metadataChunk;
      await iterator.next();
      await iterator.next();
    }
  });

  test('finishes after the response stream is consumed', async () => {
    const table = tableFromArrays({ id: [1] });
    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('example')),
      table
    )) {
      messages.push(message);
    }

    let finished = false;
    const reader = await createFlightStreamReader(
      asAsync(messages),
      () => { finished = true; }
    );

    for await (const chunk of reader) {
      void chunk;
    }

    assert.strictEqual(finished, true);
  });

  test('cancels before response iteration starts', async () => {
    const table = tableFromArrays({ id: [1] });
    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('example')),
      table
    )) {
      messages.push(message);
    }

    let sourceCancelled = false;
    let finished = false;
    const source = async function* (): AsyncIterable<FlightData> {
      try {
        yield* messages;
      }
      finally {
        sourceCancelled = true;
      }
    };
    const reader = await createFlightStreamReader(
      source(),
      () => { finished = true; }
    );

    await reader.cancel();

    assert.strictEqual(sourceCancelled, true);
    assert.strictEqual(finished, true);
  });
});

async function* asAsync<T>(values: Iterable<T>): AsyncIterable<T> {
  yield* values;
}
