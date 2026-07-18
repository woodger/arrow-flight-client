import type { FlightClient } from './flight-client';

/** Collects one complete DoGet response into an Arrow table. */
export async function doGetTable(client: FlightClient, ticket: Uint8Array) {
  return client.getTable(ticket);
}
