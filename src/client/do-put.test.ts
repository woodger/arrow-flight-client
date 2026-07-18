import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { tableFromArrays } from 'apache-arrow';
import { doPutTable } from './do-put';
import type { FlightClient } from './flight-client';
import type { FlightDescriptor } from './types';

describe('doPutTable', () => {
  test('delegates to the table upload API with a path descriptor', async () => {
    const table = tableFromArrays({ id: [1, 2] });
    let receivedDescriptor: FlightDescriptor | undefined;

    const client = {
      async putTable(descriptor: FlightDescriptor) {
        receivedDescriptor = descriptor;
        return [];
      }
    } as unknown as FlightClient;

    await doPutTable(client, table, ['example']);

    assert.deepStrictEqual(receivedDescriptor, {
      type: 'path',
      path: ['example']
    });
  });
});
