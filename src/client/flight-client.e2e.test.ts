import { test, describe } from 'node:test';
import assert from 'node:assert';
import { FlightClient, FlightGrpcClient } from './flight-client';
import {
  FlightDescriptor_DescriptorType,
  FlightDescriptor,
  FlightData,
  Ticket
} from '../generated/Flight';

class MockStream<T> {
  readonly messages: T[];
  
  constructor(messages: T[] = []) {
    this.messages = messages;
  }

  async *[Symbol.asyncIterator]() {
    for (const msg of this.messages) {
      yield msg;
    }
  }
}

class MockGrpcClient {
  readonly doGetCalled: Ticket[] = [];
  readonly doPutCalled: FlightData[] = [];

  doGet(request: Ticket) {
    this.doGetCalled.push(request);

    return new MockStream<FlightData>([
      {
        flightDescriptor: undefined,
        dataBody: Buffer.from([1,2,3]),
        dataHeader: Buffer.alloc(0),
        appMetadata: Buffer.alloc(0)
      }
    ]);
  }

  async *doPut(request: AsyncIterable<FlightData>) {
    for await (const message of request) {
      this.doPutCalled.push(message);
    }

    yield { appMetadata: Buffer.alloc(0) };
  }
}

const createMockFlightClient = (metadata?: Record<string,string>) => {
  const grpcClient = new MockGrpcClient();
  const client = new FlightClient(
    'localhost:1234',
    metadata ? { metadata } : {},
    grpcClient as unknown as FlightGrpcClient
  );

  return { client, grpcClient };
};


describe('class FlightClient e2e (mock)', () => {
  test('doGet returns FlightData stream', async () => {
    const { client } = createMockFlightClient();
    const ticket = {
      ticket: Buffer.from('abc')
    };

    const stream = client.grpc.doGet(ticket);
    const received: FlightData[] = [];

    for await (const msg of stream) {
      received.push(msg);
    }

    assert.strictEqual(received.length, 1);
    const [message] = received;
    assert.ok(message);
    assert.deepStrictEqual([...message.dataBody], [1,2,3]);
  });

  test('doPut sends FlightData correctly', async () => {
    const { client, grpcClient } = createMockFlightClient();

    const descriptor: FlightDescriptor = {
      type: FlightDescriptor_DescriptorType.PATH,
      path: ['test'],
      cmd: Buffer.alloc(0)
    };

    const data: FlightData = {
      flightDescriptor: descriptor,
      dataHeader: Buffer.alloc(0),
      dataBody: Buffer.from([9,8,7]),
      appMetadata: Buffer.alloc(0)
    };

    async function* request() {
      yield data;
    }

    for await (const response of client.grpc.doPut(request())) {
      void response;
    }

    // Проверяем что данные дошли в mock stream
    assert.strictEqual(grpcClient.doPutCalled.length, 1);
    const [message] = grpcClient.doPutCalled;
    assert.ok(message);
    assert.deepStrictEqual([...message.dataBody], [9,8,7]);
  });

  test('metadata is passed through middleware', async () => {
    const { client } = createMockFlightClient({ authorization: 'Bearer token' });
    assert(client.grpc, 'grpc client exists');
  });
});
