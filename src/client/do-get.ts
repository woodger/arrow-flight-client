import type { FlightClient } from './flight-client';

export async function doGetTable(client: FlightClient, ticket: Uint8Array) {
  return client.getTable(ticket);
}
