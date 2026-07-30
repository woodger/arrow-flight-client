import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Message, tableFromArrays, util } from 'apache-arrow';
import { ClientError, createServer, Status } from 'nice-grpc';
import type { CallContext } from 'nice-grpc';
import { FlightClient } from './flight-client';
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

    const server = createServer();
    server.add(FlightServiceDefinition, createFlightService({
      async *doGet() {
        yield* messages;
      }
    }));
    const port = await server.listen('127.0.0.1:0');
    const client = new FlightClient(`127.0.0.1:${port}`);

    try {
      const actual = await client.getTable(Buffer.from('ticket'));

      assert.deepStrictEqual(actual.toArray(), expected.toArray());
      assert.ok(util.compareSchemas(actual.schema, expected.schema));
    }
    finally {
      await client.close();
      await server.shutdown();
    }
  });

  test('uploads a schema and record batches with the descriptor only first', async () => {
    const table = tableFromArrays({ id: [1, 2] });
    const received: FlightData[] = [];
    const server = createServer();
    server.add(FlightServiceDefinition, createFlightService({
      async *doPut(request: AsyncIterable<FlightData>) {
        for await (const message of request) {
          received.push(message);
        }

        yield { appMetadata: Buffer.from('committed') };
      }
    }));
    const port = await server.listen('127.0.0.1:0');
    const client = new FlightClient(`127.0.0.1:${port}`);

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
      await server.shutdown();
    }
  });

  test('forwards per-call metadata', async () => {
    const server = createServer();
    server.add(FlightServiceDefinition, createFlightService({
      async *listActions(_request, context) {
        const requestId = context.metadata.get('x-request-id');

        yield {
          type: typeof requestId === 'string' ? requestId : '',
          description: ''
        };
      }
    }));
    const port = await server.listen('127.0.0.1:0');
    const client = new FlightClient(`127.0.0.1:${port}`);

    try {
      const actions = [];

      for await (const action of client.listActions({
        metadata: { 'x-request-id': 'request-1' }
      })) {
        actions.push(action);
      }

      assert.deepStrictEqual(actions, [
        { type: 'request-1', description: '' }
      ]);
    }
    finally {
      await client.close();
      await server.shutdown();
    }
  });

  test('reports expired unary calls as DEADLINE_EXCEEDED', async () => {
    const server = createServer();
    server.add(FlightServiceDefinition, createFlightService({
      getFlightInfo: async (_request, context) => {
        return waitForCancellation(context.signal);
      }
    }));
    const port = await server.listen('127.0.0.1:0');
    const client = new FlightClient(`127.0.0.1:${port}`);

    try {
      await assert.rejects(
        client.getFlightInfo(pathDescriptor('expired'), {
          deadline: new Date(Date.now() + 100)
        }),
        (error: unknown) => {
          assert.ok(error instanceof ClientError);
          assert.strictEqual(error.code, Status.DEADLINE_EXCEEDED);
          assert.strictEqual(
            error.path,
            '/arrow.flight.protocol.FlightService/GetFlightInfo'
          );
          return true;
        }
      );
    }
    finally {
      await client.close();
      await server.shutdown();
    }
  });

  test('reports expired streaming calls as DEADLINE_EXCEEDED', async () => {
    const server = createServer();
    server.add(FlightServiceDefinition, createFlightService({
      async *listActions(_request, context) {
        await waitForCancellation(context.signal);
        yield* [];
      }
    }));
    const port = await server.listen('127.0.0.1:0');
    const client = new FlightClient(`127.0.0.1:${port}`);

    try {
      await assert.rejects(
        async () => {
          for await (const action of client.listActions({
            deadline: new Date(Date.now() + 100)
          })) {
            void action;
          }
        },
        (error: unknown) => {
          assert.ok(error instanceof ClientError);
          assert.strictEqual(error.code, Status.DEADLINE_EXCEEDED);
          assert.strictEqual(
            error.path,
            '/arrow.flight.protocol.FlightService/ListActions'
          );
          return true;
        }
      );
    }
    finally {
      await client.close();
      await server.shutdown();
    }
  });

  test('keeps a far-future deadline active', async () => {
    const server = createServer();
    server.add(FlightServiceDefinition, createFlightService({
      async *listActions() {
        yield { type: 'available', description: '' };
      }
    }));
    const port = await server.listen('127.0.0.1:0');
    const client = new FlightClient(`127.0.0.1:${port}`);

    try {
      const actions = [];

      for await (const action of client.listActions({
        deadline: new Date(Date.now() + 3_000_000_000)
      })) {
        actions.push(action);
      }

      assert.deepStrictEqual(actions, [
        { type: 'available', description: '' }
      ]);
    }
    finally {
      await client.close();
      await server.shutdown();
    }
  });

  test('rejects a streaming call whose deadline passed before iteration', async () => {
    let started = false;
    const server = createServer();
    server.add(FlightServiceDefinition, createFlightService({
      async *listActions() {
        started = true;
        yield { type: 'unexpected', description: '' };
      }
    }));
    const port = await server.listen('127.0.0.1:0');
    const client = new FlightClient(`127.0.0.1:${port}`);
    const actions = client.listActions({ deadline: new Date(0) });

    try {
      await assert.rejects(
        async () => {
          for await (const action of actions) {
            void action;
          }
        },
        (error: unknown) => {
          assert.ok(error instanceof ClientError);
          assert.strictEqual(error.code, Status.DEADLINE_EXCEEDED);
          return true;
        }
      );
      assert.strictEqual(started, false);
    }
    finally {
      await client.close();
      await server.shutdown();
    }
  });

  test('keeps caller cancellation as AbortError with a deadline', async () => {
    const server = createServer();
    server.add(FlightServiceDefinition, createFlightService({}));
    const port = await server.listen('127.0.0.1:0');
    const client = new FlightClient(`127.0.0.1:${port}`);
    const controller = new AbortController();
    controller.abort();

    try {
      await assert.rejects(
        client.getFlightInfo(pathDescriptor('cancelled'), {
          signal: controller.signal,
          deadline: new Date(Date.now() + 10_000)
        }),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.strictEqual(error.name, 'AbortError');
          assert.ok(!(error instanceof ClientError));
          return true;
        }
      );
    }
    finally {
      await client.close();
      await server.shutdown();
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

  test('removes configured metadata with an empty per-call value', async () => {
    const server = createServer();
    server.add(FlightServiceDefinition, createFlightService({
      async *listActions(_request, context: CallContext) {
        const authorization = context.metadata.get('authorization');

        yield {
          type: authorization === undefined ? 'absent' : 'present',
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

      for await (const action of client.listActions({
        metadata: { authorization: [] }
      })) {
        actions.push(action);
      }

      assert.deepStrictEqual(actions, [
        { type: 'absent', description: '' }
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

  test('closes the owned channel', async () => {
    const server = createServer();
    server.add(FlightServiceDefinition, createFlightService({
      async *listActions() {
        yield { type: 'available', description: '' };
      }
    }));
    const port = await server.listen('127.0.0.1:0');
    const client = new FlightClient(`127.0.0.1:${port}`);

    try {
      const beforeClose = [];

      for await (const action of client.raw.listActions({})) {
        beforeClose.push(action);
      }

      assert.strictEqual(beforeClose.length, 1);
      await client.close();

      await assert.rejects(async () => {
        for await (const action of client.raw.listActions({})) {
          void action;
        }
      });
    }
    finally {
      await client.close();
      await server.shutdown();
    }
  });
});

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

function waitForCancellation(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const cancel = () => {
      const error = new Error('Call cancelled');
      error.name = 'AbortError';
      reject(error);
    };

    if (signal.aborted) {
      cancel();
    }
    else {
      signal.addEventListener('abort', cancel, { once: true });
    }
  });
}
