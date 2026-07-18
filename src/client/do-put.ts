import type { Table } from 'apache-arrow';
import type { FlightClient } from './flight-client';
import { pathDescriptor } from './types';

/** Uploads a table and consumes all server acknowledgements. */
export async function doPutTable(client: FlightClient, table: Table, path: string[]) {
  await client.putTable(pathDescriptor(...path), table);
}
