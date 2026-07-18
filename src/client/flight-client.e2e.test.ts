import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Message, tableFromArrays, util } from 'apache-arrow';
import { FlightClient } from './flight-client';
import type { FlightGrpcClient } from './flight-client';
import type { CallOptions } from 'nice-grpc';
import { encodeFlightData } from './ipc';
import { encodeDescriptor } from './protocol';
import { pathDescriptor } from './types';
import type { FlightData } from '../generated/Flight';

describe('Flight client integration', () => {
  test('downloads FlightData as an Arrow table', async () => {
    const expected = tableFromArrays({ id: [1, 2], name: ['one', 'two'] });
    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('example')),
      expected
    )) {
      messages.push(message);
    }

    const grpcClient = {
      async *doGet() {
        yield* messages;
      }
    } as unknown as FlightGrpcClient;
    const client = createClientWithRaw(grpcClient);

    try {
      const actual = await client.getTable(Buffer.from('ticket'));

      assert.deepStrictEqual(actual.toArray(), expected.toArray());
      assert.ok(util.compareSchemas(actual.schema, expected.schema));
    }
    finally {
      await client.close();
    }
  });

  test('uploads a schema and record batches with the descriptor only first', async () => {
    const table = tableFromArrays({ id: [1, 2] });
    const received: FlightData[] = [];
    const grpcClient = {
      async *doPut(request: AsyncIterable<FlightData>) {
        for await (const message of request) {
          received.push(message);
        }

        yield { appMetadata: Buffer.from('committed') };
      }
    } as unknown as FlightGrpcClient;
    const client = createClientWithRaw(grpcClient);

    try {
      const results = await client.putTable(pathDescriptor('example'), table);

      assert.ok(received.length >= 2);
      assert.deepStrictEqual(received[0]?.flightDescriptor?.path, ['example']);
      assert.ok(received.slice(1).every(({ flightDescriptor }) => !flightDescriptor));
      assert.ok(Message.decode(received[0]?.dataHeader ?? []).isSchema());
      assert.ok(received.some(({ dataHeader }) => (
        Message.decode(dataHeader).isRecordBatch()
      )));
      assert.deepStrictEqual(
        results.map(({ appMetadata }) => Buffer.from(appMetadata).toString()),
        ['committed']
      );
    }
    finally {
      await client.close();
    }
  });

  test('forwards call metadata and deadline cancellation', async () => {
    let receivedOptions: CallOptions | undefined;
    const grpcClient = {
      async *listActions(_request: unknown, options?: CallOptions) {
        receivedOptions = options;
        yield { type: 'cancel', description: 'Cancel work' };
      }
    } as unknown as FlightGrpcClient;
    const client = createClientWithRaw(grpcClient);

    try {
      const actions = [];

      for await (const action of client.listActions({
        deadline: new Date(Date.now() + 10_000),
        metadata: { 'x-request-id': 'request-1' }
      })) {
        actions.push(action);
      }

      assert.deepStrictEqual(actions, [
        { type: 'cancel', description: 'Cancel work' }
      ]);
      assert.strictEqual(
        receivedOptions?.metadata?.get('x-request-id'),
        'request-1'
      );
      assert.ok(receivedOptions?.signal);
    }
    finally {
      await client.close();
    }
  });
});

function createClientWithRaw(grpcClient: FlightGrpcClient): FlightClient {
  const client = new FlightClient('localhost:1234');

  Object.defineProperty(client, 'client', { value: grpcClient });
  return client;
}
