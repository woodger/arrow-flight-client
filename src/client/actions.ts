import type { FlightClient } from './flight-client';
import type { FlightDescriptor } from './types';

/** Collects the complete ListFlights response stream. */
export async function listFlights(client: FlightClient, criteria?: Uint8Array) {
  const result = [];

  for await (const flight of client.listFlights(criteria)) {
    result.push(flight);
  }

  return result;
}

/** Compatibility wrapper for `FlightClient.getFlightInfo()`. */
export async function getFlightInfo(client: FlightClient, descriptor: FlightDescriptor) {
  return client.getFlightInfo(descriptor);
}
