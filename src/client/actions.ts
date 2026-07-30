/**
 * Compatibility action helpers preserve the original standalone discovery API.
 *
 * Allowed here:
 * - adapting FlightClient discovery calls to standalone functions;
 * - collecting streamed flight information for compatibility callers;
 * - forwarding project-owned descriptors without protocol conversion.
 *
 * This file must not create clients or reimplement transport behavior.
 */

import type { FlightClient } from './flight-client';
import type { FlightDescriptor } from './types';

export async function listFlights(client: FlightClient, criteria?: Uint8Array) {
  const result = [];

  for await (const flight of client.listFlights(criteria)) {
    result.push(flight);
  }

  return result;
}

export async function getFlightInfo(client: FlightClient, descriptor: FlightDescriptor) {
  return client.getFlightInfo(descriptor);
}
