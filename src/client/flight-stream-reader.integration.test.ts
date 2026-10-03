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
    const batchReleased = new Promise<void>((resolve) => {
      releaseBatch = resolve;
    });
    const source = async function* (): AsyncIterable<FlightData> {
      yield schema;
      yield {
        flightDescriptor: undefined,
        dataHeader: Buffer.alloc(0),
        dataBody: Buffer.alloc(0),
        appMetadata: Buffer.from('before-batch')
      };
      await batchReleased;
      yield batch;
    };
    const reader = await createFlightStreamReader(source(), () => undefined);
    const iterator = reader[Symbol.asyncIterator]();
    let timeout: NodeJS.Timeout | undefined;

    try {
      const firstResult = await Promise.race([
        iterator.next(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error(
            'Metadata must arrive without releasing the pending record batch'
          )), 2_000);
        })
      ]);

      assert.strictEqual(firstResult.done, false);
      assert.strictEqual(firstResult.value?.data, null);
      assert.strictEqual(
        Buffer.from(firstResult.value?.appMetadata ?? []).toString(),
        'before-batch'
      );
    }
    finally {
      clearTimeout(timeout);
      releaseBatch?.();
      await reader.cancel();
      await iterator.return?.(undefined);
    }
  });

  test('preserves metadata on schema and dictionary messages', async () => {
    const table = tableFromArrays({ name: ['one', 'two'] });
    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('example')),
      table
    )) {
      const ipcMessage = Message.decode(message.dataHeader);
      message.appMetadata = Buffer.from(
        ipcMessage.isSchema() ? 'schema' : ipcMessage.isDictionaryBatch() ? 'dictionary' : 'batch'
      );
      messages.push(message);
    }

    const reader = await createFlightStreamReader(asAsync(messages), () => undefined);
    const chunks = [];

    for await (const chunk of reader) {
      chunks.push(chunk);
    }

    assert.deepStrictEqual(
      chunks.map(({ appMetadata }) => Buffer.from(appMetadata ?? []).toString()),
      ['schema', 'dictionary', 'batch']
    );
    assert.deepStrictEqual(chunks.map(({ data }) => data?.numRows ?? null), [null, null, 2]);
    assert.deepStrictEqual(chunks[2]?.data?.toArray(), table.toArray());
  });

  test('does not drain metadata while consumption is paused', async () => {
    const table = tableFromArrays({ id: [1] });
    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('example')),
      table
    )) {
      messages.push(message);
    }

    const schema = messages[0];
    assert.ok(schema);
    const metadataCount = 1_000;
    let metadataRead = 0;
    let sourceClosed = false;
    const source = async function* (): AsyncIterable<FlightData> {
      try {
        yield schema;

        for (let index = 0; index < metadataCount; index++) {
          metadataRead++;
          yield {
            flightDescriptor: undefined,
            dataHeader: Buffer.alloc(0),
            dataBody: Buffer.alloc(0),
            appMetadata: Buffer.from(String(index))
          };
        }

        yield* messages.slice(1);
      }
      finally {
        sourceClosed = true;
      }
    };
    const reader = await createFlightStreamReader(source(), () => undefined);
    const iterator = reader[Symbol.asyncIterator]();

    try {
      const first = await iterator.next();
      assert.strictEqual(first.value?.data, null);
      assert.strictEqual(Buffer.from(first.value?.appMetadata ?? []).toString(), '0');
      await new Promise<void>((resolve) => setImmediate(resolve));

      assert.ok(metadataRead < metadataCount, 'A paused consumer must not drain the metadata stream');

      for (let index = 1; index < metadataCount; index++) {
        const next = await iterator.next();
        assert.strictEqual(next.value?.data, null);
        assert.strictEqual(Buffer.from(next.value?.appMetadata ?? []).toString(), String(index));
      }

      assert.strictEqual((await iterator.next()).value?.data?.numRows, 1);
      assert.strictEqual((await iterator.next()).done, true);
      assert.strictEqual(sourceClosed, true);
    }
    finally {
      await iterator.return?.(undefined);
      await reader.cancel();
    }
  });

  test('cancels a reader paused on metadata without draining the source', async () => {
    const table = tableFromArrays({ id: [1] });
    const metadataCount = 1_000;
    let sourceClosed = false;
    let metadataRead = 0;
    const source = async function* (): AsyncIterable<FlightData> {
      try {
        const encoded = encodeFlightData(encodeDescriptor(pathDescriptor('example')), table);
        const schema = await encoded[Symbol.asyncIterator]().next();
        assert.ok(schema.value);
        yield schema.value;

        for (let index = 0; index < metadataCount; index++) {
          metadataRead++;
          yield {
            flightDescriptor: undefined,
            dataHeader: Buffer.alloc(0),
            dataBody: Buffer.alloc(0),
            appMetadata: Buffer.from('metadata')
          };
        }
      }
      finally {
        sourceClosed = true;
      }
    };
    const reader = await createFlightStreamReader(source(), () => undefined);
    const iterator = reader[Symbol.asyncIterator]();

    try {
      await iterator.next();
      await new Promise<void>((resolve) => setImmediate(resolve));
      await reader.cancel();

      assert.ok(metadataRead < metadataCount, 'Cancellation must not drain the metadata stream');
      assert.strictEqual(sourceClosed, true);
      await assert.rejects(iterator.next(), { name: 'AbortError' });
    }
    finally {
      await reader.cancel();
      await iterator.return?.(undefined);
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
