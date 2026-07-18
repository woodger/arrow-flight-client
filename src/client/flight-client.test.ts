import { test, describe } from 'node:test';
import assert from 'node:assert';
import { FlightClient, FlightClientOptions } from './flight-client';
import { FlightDescriptor, FlightDescriptor_DescriptorType, FlightData } from '../generated/Flight';

describe('class FlightClient', () => {
  test('should create FlightClient instance', () => {
    const client = new FlightClient('localhost:1234');
    assert(client.grpc, 'Client should have grpc property');
  });

  test('should handle TLS option', () => {
    const opts: FlightClientOptions = { tls: true };
    const client = new FlightClient('localhost:1234', opts);

    assert(client.grpc, 'TLS client should have grpc property');
  });

  test('should accept metadata', () => {
    const opts: FlightClientOptions = { metadata: { authorization: 'Bearer token' } };
    const client = new FlightClient('localhost:1234', opts);
    
    assert(client.grpc, 'Client with metadata should have grpc property');
  });

  test('FlightDescriptor minimal construction', () => {
    const descriptor: FlightDescriptor = {
      type: FlightDescriptor_DescriptorType.PATH,
      path: ['example'],
      cmd: Buffer.alloc(0)
    };

    assert.strictEqual(descriptor.type, FlightDescriptor_DescriptorType.PATH);
    assert.deepStrictEqual(descriptor.path, ['example']);
    assert.ok(Buffer.isBuffer(descriptor.cmd));
  });

  test('FlightData minimal construction', () => {
    const descriptor: FlightDescriptor = {
      type: FlightDescriptor_DescriptorType.PATH,
      path: ['example'],
      cmd: Buffer.alloc(0)
    };

    const data: FlightData = {
      flightDescriptor: descriptor,
      dataHeader: Buffer.alloc(0),
      dataBody: Buffer.from([1, 2, 3]),
      appMetadata: Buffer.alloc(0)
    };
    
    assert.ok(data.flightDescriptor);
    assert.strictEqual(data.flightDescriptor.type, FlightDescriptor_DescriptorType.PATH);
    assert.ok(Buffer.isBuffer(data.dataBody));
    assert.deepStrictEqual([...data.dataBody], [1,2,3]);
  });
});
