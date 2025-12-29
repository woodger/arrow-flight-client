import type { FlightClient } from './flight-client';
export declare function doGetTable(client: FlightClient, ticket: Uint8Array): Promise<import("apache-arrow").Table<any>>;
