import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Table, tableFromArrays, tableToIPC, util } from 'apache-arrow';
import {
  decodeFlightInfo,
  decodePollInfo,
  encodeDescriptor
} from './protocol';
import { commandDescriptor, pathDescriptor } from './types';
import { FlightDescriptor_DescriptorType } from '../generated/Flight';

describe('Flight protocol adapter', () => {
  describe('encodeDescriptor', () => {
    test('encodes a path descriptor', () => {
      assert.deepStrictEqual(encodeDescriptor(pathDescriptor('db', 'table')), {
        type: FlightDescriptor_DescriptorType.PATH,
        path: ['db', 'table'],
        cmd: Buffer.alloc(0)
      });
    });

    test('encodes a command descriptor', () => {
      assert.deepStrictEqual(
        encodeDescriptor(commandDescriptor(Buffer.from('sql'))),
        {
          type: FlightDescriptor_DescriptorType.CMD,
          path: [],
          cmd: Buffer.from('sql')
        }
      );
    });
  });

  describe('decodeFlightInfo', () => {
    test('returns project-owned Flight information', () => {
      const table = tableFromArrays({ id: [1] });
      const endpointExpiration = new Date('2026-07-18T00:00:00Z');
      const info = decodeFlightInfo({
        schema: schemaMessage(table),
        flightDescriptor: encodeDescriptor(pathDescriptor('example')),
        endpoint: [{
          ticket: { ticket: Buffer.from('ticket') },
          location: [{ uri: 'grpc://other:8815' }],
          expirationTime: endpointExpiration,
          appMetadata: Buffer.from('endpoint')
        }],
        totalRecords: 1,
        totalBytes: 8,
        ordered: true,
        appMetadata: Buffer.from('info')
      });

      assert.ok(util.compareSchemas(info.schema, table.schema));
      assert.deepStrictEqual(info.descriptor, pathDescriptor('example'));
      assert.strictEqual(
        Buffer.from(info.endpoints[0]?.ticket ?? []).toString(),
        'ticket'
      );
      assert.deepStrictEqual(
        info.endpoints[0]?.locations,
        ['grpc://other:8815']
      );
      assert.strictEqual(
        info.endpoints[0]?.expirationTime,
        endpointExpiration
      );
      assert.strictEqual(
        Buffer.from(info.endpoints[0]?.appMetadata ?? []).toString(),
        'endpoint'
      );
      assert.strictEqual(info.totalRecords, 1);
      assert.strictEqual(info.totalBytes, 8);
      assert.strictEqual(info.ordered, true);
      assert.strictEqual(Buffer.from(info.appMetadata).toString(), 'info');
    });
  });

  describe('decodePollInfo', () => {
    test('returns project-owned polling information', () => {
      const expiration = new Date('2026-07-18T00:00:00Z');
      const poll = decodePollInfo({
        info: undefined,
        flightDescriptor: encodeDescriptor(pathDescriptor('next')),
        progress: 0.5,
        expirationTime: expiration
      });

      assert.strictEqual(poll.info, undefined);
      assert.deepStrictEqual(poll.descriptor, pathDescriptor('next'));
      assert.strictEqual(poll.progress, 0.5);
      assert.strictEqual(poll.expirationTime, expiration);
    });
  });
});

function schemaMessage(table: Table): Buffer {
  const ipc = Buffer.from(tableToIPC(new Table(table.schema, []), 'stream'));
  const prefixLength = ipc.readInt32LE(0) === -1 ? 8 : 4;
  const metadataLength = ipc.readInt32LE(prefixLength - 4);

  return ipc.subarray(0, prefixLength + metadataLength);
}
