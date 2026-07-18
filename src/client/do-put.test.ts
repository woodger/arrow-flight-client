import { describe, test } from 'node:test';
import assert from 'node:assert';
import { tableFromArrays } from 'apache-arrow';
import { doPutTable } from './do-put';
import { FlightClient } from './flight-client';
import type { FlightGrpcClient } from './flight-client';
import type { FlightData } from '../generated/Flight';

describe('doPutTable', () => {
  test('sends the table through the request stream', async () => {
    const received: FlightData[] = [];
    const grpcClient = {
      async *doPut(request: AsyncIterable<FlightData>) {
        for await (const message of request) {
          received.push(message);
        }

        yield { appMetadata: Buffer.alloc(0) };
      }
    } as unknown as FlightGrpcClient;
    const client = new FlightClient('unused', {}, grpcClient);
    const table = tableFromArrays({ id: [1, 2] });

    await doPutTable(client, table, ['example']);

    assert.strictEqual(received.length, 1);
    const [message] = received;
    assert.ok(message);
    assert.ok(message.flightDescriptor);
    assert.deepStrictEqual(message.flightDescriptor.path, ['example']);
    assert.ok(message.dataBody.byteLength > 0);
  });
});
