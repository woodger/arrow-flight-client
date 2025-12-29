import { ClientMiddleware, CallOptions } from 'nice-grpc';
import { Metadata } from 'nice-grpc-common';

export function metadataMiddleware(
  headers: Record<string, string | string[]>
): ClientMiddleware {
  return async function* (call, options: CallOptions) {
    const metadata = new Metadata();

    for (const [key, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          metadata.append(key, v);
        }
      }
      else {
        metadata.set(key, value);
      }
    }

    return yield* call.next(call.request, {
      ...options,
      metadata,
    });
  }
}
