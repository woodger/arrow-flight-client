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

      // The deprecated alias remains a supported compatibility contract.
      // oxlint-disable-next-line typescript/no-deprecated
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

    test('releases resources for an active streaming call', async () => {
      const client = new FlightClient('localhost:1234');
      const controller = new AbortController();
      const actions = client.listActions({
        signal: controller.signal,
        deadline: new Date(Date.now() + 3_000_000_000)
      });
      const nextAction = actions[Symbol.asyncIterator]().next();

      assert.strictEqual(
        getEventListeners(controller.signal, 'abort').length,
        1
      );
      await client.close();
      assert.strictEqual(
        getEventListeners(controller.signal, 'abort').length,
        0
      );
      await assert.rejects(nextAction);
    });
  });

  describe('#listActions', () => {
    test('does not prepare resources before iteration', async () => {
      const client = new FlightClient('localhost:1234');
      const controller = new AbortController();
      const actions = client.listActions({
        signal: controller.signal,
        deadline: new Date(Date.now() + 3_000_000_000)
      });
      const iterator = actions[Symbol.asyncIterator]();

      assert.strictEqual(
        getEventListeners(controller.signal, 'abort').length,
        0
      );
      await iterator.return?.(undefined);
      assert.strictEqual(
        getEventListeners(controller.signal, 'abort').length,
        0
      );
      await client.close();
    });

    test('rejects an invalid deadline before iteration', async () => {
      const client = new FlightClient('localhost:1234');

      assert.throws(
        () => client.listActions({ deadline: new Date(Number.NaN) }),
        /deadline must be a valid Date/
      );
      await client.close();
    });
  });
});
