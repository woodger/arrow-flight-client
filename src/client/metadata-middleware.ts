import type { ClientMiddleware, CallOptions } from 'nice-grpc';
import { Metadata } from 'nice-grpc-common';
import type { FlightMetadata } from './types';

/**
 * Client metadata middleware applies configured headers to every gRPC call.
 *
 * Per-call values replace configured values with the same key so callers can
 * override authentication or tracing metadata without duplicating defaults.
 */
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
