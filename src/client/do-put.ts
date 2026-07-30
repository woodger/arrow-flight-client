/**
 * The DoPut compatibility helper preserves the standalone path upload API.
 *
 * Allowed here:
 * - translating legacy string paths into project-owned descriptors;
 * - delegating table uploads to a caller-owned FlightClient.
 *
 * This file must not own client lifecycle or encode Arrow IPC messages.
 */

import type { Table } from 'apache-arrow';
import type { FlightClient } from './flight-client';
import { pathDescriptor } from './types';

export async function doPutTable(client: FlightClient, table: Table, path: string[]) {
  await client.putTable(pathDescriptor(...path), table);
}
