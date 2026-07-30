import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { tableFromArrays } from 'apache-arrow';
import type { Table } from 'apache-arrow';
import { doPutTable } from './do-put';
import type { FlightClient } from './flight-client';
import type { FlightDescriptor } from './types';

describe('doPutTable', () => {
  test('delegates to the table upload API with a path descriptor', async () => {
    const table = tableFromArrays({ id: [1, 2] });
    let receivedDescriptor: FlightDescriptor | undefined;
    let receivedTable: Table | undefined;
    let callCount = 0;

    const client = {
      async putTable(descriptor: FlightDescriptor, source: Table) {
        callCount++;
        receivedDescriptor = descriptor;
        receivedTable = source;
        return [];
      }
    } as unknown as FlightClient;

    await doPutTable(client, table, ['example']);

    assert.deepStrictEqual(receivedDescriptor, {
      type: 'path',
      path: ['example']
    });
    assert.strictEqual(receivedTable, table);
    assert.strictEqual(callCount, 1);
  });
});
