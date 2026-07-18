import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { FlightClient } from './flight-client';
import type { FlightClientOptions } from './types';

describe('FlightClient', () => {
  describe('constructor', () => {
    test('creates an insecure client', async () => {
      const client = new FlightClient('localhost:1234');

      assert.ok(client.raw);
      assert.strictEqual(client.grpc, client.raw);
      await client.close();
    });

    test('creates a TLS client', async () => {
      const options: FlightClientOptions = { tls: true };
      const client = new FlightClient('localhost:1234', options);

      assert.ok(client.raw);
      await client.close();
    });

    test('rejects an incomplete mTLS identity', () => {
      assert.throws(
        () => new FlightClient('localhost:1234', {
          tls: { privateKey: Buffer.from('key') }
        }),
        /privateKey and certificateChain/
      );
    });
  });

  describe('#close', () => {
    test('is idempotent and rejects new high-level calls', async () => {
      const client = new FlightClient('localhost:1234');

      const firstClose = client.close();
      const secondClose = client.close();

      assert.strictEqual(firstClose, secondClose);
      await firstClose;

      assert.throws(() => client.listActions(), /closed/);
    });
  });
});
