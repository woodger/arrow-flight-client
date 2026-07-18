/**
 * Client metadata middleware owns outgoing metadata composition.
 *
 * Allowed here:
 * - translating configured headers into nice-grpc metadata;
 * - preserving repeated values;
 * - applying per-call values as overrides for matching configured keys.
 *
 * This file must not implement authentication flows or own channel lifecycle.
 */

import type { ClientMiddleware, CallOptions } from 'nice-grpc';
import { Metadata } from 'nice-grpc-common';
import type { FlightMetadata } from './types';

export function metadataMiddleware(headers: FlightMetadata): ClientMiddleware {
  return async function* (call, options: CallOptions) {
    const metadata = new Metadata();

    for (const [key, value] of Object.entries(headers)) {
      const values = Array.isArray(value) ? [...value] : [value];

      for (const item of values) {
        metadata.append(key, item);
      }
    }

    for (const [key, values] of options.metadata ?? []) {
      metadata.delete(key);

      for (const value of values) {
        metadata.append(key, value);
      }
    }

    return yield* call.next(call.request, {
      ...options,
      metadata
    });
  }
}
