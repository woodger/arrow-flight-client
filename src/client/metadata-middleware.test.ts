import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { CallOptions, ClientMiddlewareCall } from 'nice-grpc-common';
import { Metadata } from 'nice-grpc-common';
import { metadataMiddleware } from './metadata-middleware';

describe('metadataMiddleware', () => {
  test('keeps defaults and lets per-call metadata replace matching keys', async () => {
    let receivedOptions: CallOptions | undefined;
    const call = {
      requestStream: false,
      responseStream: false,
      request: {},
      method: {},
      async *next(_request: unknown, options: CallOptions) {
        receivedOptions = options;
        yield* [];
        return 'response';
      }
    } as unknown as ClientMiddlewareCall<unknown, string>;
    const perCall = new Metadata({ authorization: 'Bearer override' });
    const generator = metadataMiddleware({
      authorization: 'Bearer default',
      'x-client': 'client-1'
    })(call, { metadata: perCall });

    const result = await generator.next();

    assert.deepStrictEqual(result, { done: true, value: 'response' });
    assert.strictEqual(
      receivedOptions?.metadata?.get('authorization'),
      'Bearer override'
    );
    assert.strictEqual(
      receivedOptions?.metadata?.get('x-client'),
      'client-1'
    );
  });
});
