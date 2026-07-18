import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Message, tableFromArrays, util } from 'apache-arrow';
import { ClientError, createServer, Status } from 'nice-grpc';
import type { CallContext } from 'nice-grpc';
import { FlightClient } from './flight-client';
import type { FlightGrpcClient } from './flight-client';
import type { CallOptions } from 'nice-grpc';
import { encodeFlightData } from './ipc';
import { encodeDescriptor } from './protocol';
import { pathDescriptor } from './types';
import { FlightServiceDefinition } from '../generated/Flight';
import type {
  FlightData,
  FlightServiceImplementation
} from '../generated/Flight';

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

  test('sends configured metadata through the client middleware', async () => {
    const server = createServer();
    server.add(FlightServiceDefinition, createFlightService({
      async *listActions(_request, context: CallContext) {
        const authorization = context.metadata.get('authorization');

        yield {
          type: typeof authorization === 'string' ? authorization : '',
          description: ''
        };
      }
    }));
    const port = await server.listen('127.0.0.1:0');
    const client = new FlightClient(`127.0.0.1:${port}`, {
      metadata: { authorization: 'Bearer configured' }
    });

    try {
      const actions = [];

      for await (const action of client.listActions()) {
        actions.push(action);
      }

      assert.deepStrictEqual(actions, [
        { type: 'Bearer configured', description: '' }
      ]);
    }
    finally {
      await client.close();
      await server.shutdown();
    }
  });

  test('receives a Flight message larger than four MiB when configured', async () => {
    const rowCount = 700_000;
    const expected = tableFromArrays({
      value: new Float64Array(rowCount).fill(1.25)
    });
    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('large')),
      expected
    )) {
      messages.push(message);
    }

    assert.ok(messages.some(({ dataBody }) => dataBody.byteLength > 4 * 1024 * 1024));

    const server = createServer({
      'grpc.max_send_message_length': 8 * 1024 * 1024
    });
    server.add(FlightServiceDefinition, createFlightService({
      async *doGet() {
        yield* messages;
      }
    }));
    const port = await server.listen('127.0.0.1:0');
    const client = new FlightClient(`127.0.0.1:${port}`, {
      maxReceiveMessageLength: 8 * 1024 * 1024
    });

    try {
      const actual = await client.getTable(Buffer.from('large'));

      assert.strictEqual(actual.numRows, rowCount);
      assert.strictEqual(actual.getChild('value')?.get(0), 1.25);
    }
    finally {
      await client.close();
      await server.shutdown();
    }
  });

  test('enforces the configured outgoing gRPC message limit', async () => {
    const server = createServer();
    server.add(FlightServiceDefinition, createFlightService({
      async *doPut(request) {
        for await (const message of request) {
          void message;
        }

        yield* [];
      }
    }));
    const port = await server.listen('127.0.0.1:0');
    const client = new FlightClient(`127.0.0.1:${port}`, {
      maxSendMessageLength: 1024
    });
    const table = tableFromArrays({ value: new Uint8Array(4096) });

    try {
      await assert.rejects(
        client.putTable(pathDescriptor('limited'), table),
        (error: unknown) => {
          assert.ok(error instanceof ClientError);
          assert.strictEqual(error.code, Status.RESOURCE_EXHAUSTED);
          return true;
        }
      );
    }
    finally {
      await client.close();
      await server.shutdown();
    }
  });
});

function createClientWithRaw(grpcClient: FlightGrpcClient): FlightClient {
  const client = new FlightClient('localhost:1234');

  Object.defineProperty(client, 'client', { value: grpcClient });
  return client;
}

function createFlightService(
  overrides: Partial<FlightServiceImplementation>
): FlightServiceImplementation {
  const notImplemented = async (): Promise<never> => {
    throw new Error('Not implemented');
  };

  return {
    async *handshake() {
      yield* [];
    },
    async *listFlights() {
      yield* [];
    },
    getFlightInfo: notImplemented,
    pollFlightInfo: notImplemented,
    getSchema: notImplemented,
    async *doGet() {
      yield* [];
    },
    async *doPut() {
      yield* [];
    },
    async *doExchange() {
      yield* [];
    },
    async *doAction() {
      yield* [];
    },
    async *listActions() {
      yield* [];
    },
    ...overrides
  };
}
