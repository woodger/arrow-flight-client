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
import type { FlightMetadata, FlightMetadataValue } from './types';

const metadataOverrideKeys = Symbol('metadataOverrideKeys');

interface FlightMetadataCallOptions extends CallOptions {
  [metadataOverrideKeys]?: readonly string[]
}

// Array.isArray widens readonly arrays to any[]; keep the public metadata
// element type explicit at this standard-library boundary.
export function isRepeatedMetadataValue(
  value: FlightMetadataValue | readonly FlightMetadataValue[]
): value is readonly FlightMetadataValue[] {
  return Array.isArray(value);
}

export function metadataMiddleware(headers: FlightMetadata): ClientMiddleware {
  return async function* (call, options: CallOptions) {
    const metadata = new Metadata();
    const overrideKeys = (options as FlightMetadataCallOptions)[
      metadataOverrideKeys
    ] ?? [];

    for (const [key, value] of Object.entries(headers)) {
      const values = isRepeatedMetadataValue(value)
        ? [...value]
        : [value];

      for (const item of values) {
        metadata.append(key, item);
      }
    }

    for (const key of overrideKeys) {
      metadata.delete(key);
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

export function setMetadataOverrideKeys(
  options: CallOptions,
  headers: FlightMetadata
): void {
  (options as FlightMetadataCallOptions)[metadataOverrideKeys] =
    Object.keys(headers);
}
