import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Message, tableFromArrays } from 'apache-arrow';
import { createFlightStreamReader } from './flight-stream-reader';
import { encodeFlightData } from './ipc';
import { encodeDescriptor } from './protocol';
import { pathDescriptor } from './types';
import type { FlightData } from '../generated/Flight';

describe('FlightStreamReader', () => {
  test('keeps batch and metadata-only messages in stream order', async () => {
    const table = tableFromArrays({ id: [1, 2] });
    const messages: FlightData[] = [];

    for await (const message of encodeFlightData(
      encodeDescriptor(pathDescriptor('example')),
      table
    )) {
      if (Message.decode(message.dataHeader).isRecordBatch()) {
        message.appMetadata = Buffer.from('batch');
      }
      messages.push(message);
    }
    messages.push({
      flightDescriptor: undefined,
      dataHeader: Buffer.alloc(0),
      dataBody: Buffer.alloc(0),
      appMetadata: Buffer.from('trailing')
    });

    let finished = false;
    const reader = await createFlightStreamReader(
      asAsync(messages),
      () => { finished = true; }
    );
    const chunks = [];

    for await (const chunk of reader) {
      chunks.push(chunk);
    }

    assert.strictEqual(chunks[0]?.data?.numRows, 2);
    assert.strictEqual(Buffer.from(chunks[0]?.appMetadata ?? []).toString(), 'batch');
    assert.strictEqual(chunks[1]?.data, null);
    assert.strictEqual(Buffer.from(chunks[1]?.appMetadata ?? []).toString(), 'trailing');
    assert.strictEqual(finished, true);
  });
});

async function* asAsync<T>(values: Iterable<T>): AsyncIterable<T> {
  yield* values;
}
