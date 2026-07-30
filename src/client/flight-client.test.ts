import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
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

    test('releases resources for a prepared streaming call', async () => {
      const client = new FlightClient('localhost:1234');
      const controller = new AbortController();
      const actions = client.listActions({
        signal: controller.signal,
        deadline: new Date(Date.now() + 3_000_000_000)
      });

      assert.strictEqual(
        getEventListeners(controller.signal, 'abort').length,
        1
      );
      await client.close();
      assert.strictEqual(
        getEventListeners(controller.signal, 'abort').length,
        0
      );
      void actions;
    });
  });
});
