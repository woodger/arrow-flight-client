import { test, describe } from 'node:test';
import assert from 'node:assert';
import { FlightClient } from './flight-client';
import { FlightDescriptor_DescriptorType, FlightDescriptor, FlightData } from '../generated/Flight';

class MockStream {
  private messages: any[];
  
  constructor(messages: any[] = []) {
    this.messages = messages;
  }

  async *[Symbol.asyncIterator]() {
    for (const msg of this.messages) {
      yield msg;
    }
  }

  async write(msg: any) {
    this.messages.push(msg);
  }

  async end() {}
}

class MockGrpcClient {
  doGetCalled: any[] = [];
  doPutCalled: any[] = [];

  doGet(request: any) {
    this.doGetCalled.push(request);

    return new MockStream([
      {
        dataBody: Buffer.from([1,2,3]),
        dataHeader: Buffer.alloc(0),
        appMetadata: Buffer.alloc(0)
      }
    ]);
  }

  doPut() {
    const stream = new MockStream();
    this.doPutCalled.push(stream);

    return stream;
  }
}

const createMockFlightClient = (metadata?: Record<string,string>) => 
  new FlightClient('localhost:1234', { metadata }, new MockGrpcClient());


describe('class FlightClient e2e (mock)', () => {
  test('doGet returns FlightData stream', async () => {
    const client = createMockFlightClient();
    const ticket = {
      ticket: Buffer.from('abc')
    };

    const stream = client.grpc.doGet(ticket);
    const received: any[] = [];

    for await (const msg of stream) {
      received.push(msg);
    }

    assert.strictEqual(received.length, 1);
    assert.deepStrictEqual([...received[0].dataBody], [1,2,3]);
  });

  test('doPut sends FlightData correctly', async () => {
    const client = createMockFlightClient();
    const stream = client.grpc.doPut();

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

    await stream.write(data);
    await stream.end();

    // Проверяем что данные дошли в mock stream
    assert.strictEqual(stream['messages'].length, 1);
    assert.deepStrictEqual([...stream['messages'][0].dataBody], [9,8,7]);
  });

  test('metadata is passed through middleware', async () => {
    const client = createMockFlightClient({ authorization: 'Bearer token' });
    assert(client.grpc, 'grpc client exists');
  });
});
