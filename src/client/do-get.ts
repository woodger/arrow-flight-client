/**
 * The DoGet compatibility helper preserves the standalone table download API.
 *
 * Allowed here:
 * - delegating ticket downloads to a caller-owned FlightClient;
 * - returning the client's buffered Arrow table result.
 *
 * This file must not own client lifecycle or duplicate stream decoding.
 */

import type { FlightClient } from './flight-client';

export async function doGetTable(client: FlightClient, ticket: Uint8Array) {
  return client.getTable(ticket);
}
