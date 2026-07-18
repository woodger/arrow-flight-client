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
  test('encodes project-owned descriptors', () => {
    assert.deepStrictEqual(encodeDescriptor(pathDescriptor('db', 'table')), {
      type: FlightDescriptor_DescriptorType.PATH,
      path: ['db', 'table'],
      cmd: Buffer.alloc(0)
    });
    assert.deepStrictEqual(encodeDescriptor(commandDescriptor(Buffer.from('sql'))), {
      type: FlightDescriptor_DescriptorType.CMD,
      path: [],
      cmd: Buffer.from('sql')
    });
  });

  test('decodes FlightInfo and PollInfo without generated public values', () => {
    const table = tableFromArrays({ id: [1] });
    const schema = schemaMessage(table);
    const protocolInfo = {
      schema,
      flightDescriptor: encodeDescriptor(pathDescriptor('example')),
      endpoint: [{
        ticket: { ticket: Buffer.from('ticket') },
        location: [{ uri: 'grpc://other:8815' }],
        expirationTime: new Date('2026-07-18T00:00:00Z'),
        appMetadata: Buffer.from('endpoint')
      }],
      totalRecords: 1,
      totalBytes: 8,
      ordered: true,
      appMetadata: Buffer.from('info')
    };

    const info = decodeFlightInfo(protocolInfo);
    const poll = decodePollInfo({
      info: protocolInfo,
      flightDescriptor: undefined,
      progress: 0.5,
      expirationTime: undefined
    });

    assert.ok(util.compareSchemas(info.schema, table.schema));
    assert.deepStrictEqual(info.descriptor, pathDescriptor('example'));
    assert.strictEqual(Buffer.from(info.endpoints[0]?.ticket ?? []).toString(), 'ticket');
    assert.deepStrictEqual(info.endpoints[0]?.locations, ['grpc://other:8815']);
    assert.strictEqual(poll.progress, 0.5);
    assert.ok(poll.info);
  });
});

function schemaMessage(table: Table): Buffer {
  const ipc = Buffer.from(tableToIPC(new Table(table.schema, []), 'stream'));
  const prefixLength = ipc.readInt32LE(0) === -1 ? 8 : 4;
  const metadataLength = ipc.readInt32LE(prefixLength - 4);

  return ipc.subarray(0, prefixLength + metadataLength);
}
