import type { RecordBatch, Schema, Table } from 'apache-arrow';

export type FlightMetadataValue = string | Uint8Array;

export type FlightMetadata = Readonly<Record<
  string,
  FlightMetadataValue | readonly FlightMetadataValue[]
>>;

export interface FlightTlsOptions {
  rootCertificates?: Uint8Array
  privateKey?: Uint8Array
  certificateChain?: Uint8Array
}

export interface FlightClientOptions {
  tls?: boolean | FlightTlsOptions
  metadata?: FlightMetadata
}

export interface FlightCallOptions {
  metadata?: FlightMetadata
  signal?: AbortSignal
  deadline?: Date
}

export interface FlightPathDescriptor {
  readonly type: 'path'
  readonly path: readonly string[]
}

export interface FlightCommandDescriptor {
  readonly type: 'command'
  readonly command: Uint8Array
}

export type FlightDescriptor = FlightPathDescriptor | FlightCommandDescriptor;
export type FlightTicket = Uint8Array;

export interface FlightEndpoint {
  readonly ticket?: FlightTicket
  readonly locations: readonly string[]
  readonly expirationTime?: Date
  readonly appMetadata: Uint8Array
}

export interface FlightInfo {
  readonly schema: Schema
  readonly descriptor?: FlightDescriptor
  readonly endpoints: readonly FlightEndpoint[]
  readonly totalRecords: number
  readonly totalBytes: number
  readonly ordered: boolean
  readonly appMetadata: Uint8Array
}

export interface FlightPollInfo {
  readonly info?: FlightInfo
  readonly descriptor?: FlightDescriptor
  readonly progress?: number
  readonly expirationTime?: Date
}

export interface FlightStreamChunk {
  readonly data: RecordBatch | null
  readonly appMetadata?: Uint8Array
}

export type FlightDataSource =
  | Table
  | Iterable<RecordBatch>
  | AsyncIterable<RecordBatch>;

export interface FlightPutOptions extends FlightCallOptions {
  /** Required to upload an empty iterable. A Table already carries its schema. */
  schema?: Schema
  /** Metadata attached to the initial schema message. */
  appMetadata?: Uint8Array
}

export interface FlightPutResult {
  readonly appMetadata: Uint8Array
}

export interface FlightAction {
  readonly type: string
  readonly body?: Uint8Array
}

export interface FlightActionResult {
  readonly body: Uint8Array
}

export interface FlightActionType {
  readonly type: string
  readonly description: string
}

export function pathDescriptor(...path: string[]): FlightPathDescriptor {
  return { type: 'path', path };
}

export function commandDescriptor(command: Uint8Array): FlightCommandDescriptor {
  return { type: 'command', command };
}
