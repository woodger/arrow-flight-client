import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { FlightClient } from './flight-client';

describe('FlightClient', () => {
  describe('constructor', () => {
    test('rejects an incomplete mTLS identity', () => {
      assert.throws(
        () => new FlightClient('localhost:1234', {
          tls: { privateKey: Buffer.from('key') }
        }),
        /privateKey and certificateChain/
      );
    });
  });

  describe('#raw', () => {
    test('returns the generated client', async () => {
      const client = new FlightClient('localhost:1234');

      assert.ok(client.raw);
      await client.close();
    });
  });

  describe('#grpc', () => {
    test('returns the raw generated client', async () => {
      const client = new FlightClient('localhost:1234');

      assert.strictEqual(client.grpc, client.raw);
      await client.close();
    });
  });

  describe('#close', () => {
    test('returns the same promise when called repeatedly', async () => {
      const client = new FlightClient('localhost:1234');

      const firstClose = client.close();
      const secondClose = client.close();

      assert.strictEqual(firstClose, secondClose);
      await firstClose;
    });

    test('rejects new high-level calls', async () => {
      const client = new FlightClient('localhost:1234');

      await client.close();
      assert.throws(() => client.listActions(), /closed/);
    });
  });
});
