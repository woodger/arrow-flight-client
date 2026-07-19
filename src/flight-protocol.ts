/**
 * The Flight protocol facade curates low-level contracts exposed by the package.
 *
 * Allowed here:
 * - selecting generated Flight messages and enums for public use;
 * - defining the low-level client and call metadata contracts;
 * - preserving protocol names defined by Apache Arrow Flight.
 *
 * This file must not implement transport behavior or high-level conversions.
 */

import type { Metadata as RawMetadata } from 'nice-grpc-common';
import type {
  Action,
  ActionType,
  Criteria,
  Empty,
  FlightData,
  FlightDescriptor,
  FlightInfo,
  HandshakeRequest,
  HandshakeResponse,
  PollInfo,
  PutResult,
  Result,
  SchemaResult,
  Ticket
} from './generated/Flight';

export {
  Action,
  ActionType,
  BasicAuth,
  CancelFlightInfoRequest,
  CancelFlightInfoResult,
  CancelStatus,
  CloseSessionRequest,
  CloseSessionResult,
  CloseSessionResult_Status as CloseSessionStatus,
  Criteria,
  Empty,
  FlightData,
  FlightDescriptor,
  FlightDescriptor_DescriptorType as FlightDescriptorType,
  FlightEndpoint,
  FlightInfo,
  FlightServiceDefinition,
  GetSessionOptionsRequest,
  GetSessionOptionsResult,
  HandshakeRequest,
  HandshakeResponse,
  Location,
  PollInfo,
  PutResult,
  RenewFlightEndpointRequest,
  Result,
  SchemaResult,
  SessionOptionValue,
  SessionOptionValue_StringListValue as SessionOptionStringListValue,
  SetSessionOptionsRequest,
  SetSessionOptionsResult,
  SetSessionOptionsResult_Error as SetSessionOptionsError,
  SetSessionOptionsResult_ErrorValue as SetSessionOptionsErrorValue,
  Ticket
} from './generated/Flight';
export { Metadata as RawMetadata } from 'nice-grpc-common';

export interface FlightRawCallOptions {
  metadata?: RawMetadata
  signal?: AbortSignal
  onHeader?(header: RawMetadata): void
  onTrailer?(trailer: RawMetadata): void
}

type FlightProtocolScalar =
  | Date
  | Uint8Array
  | string
  | number
  | boolean
  | undefined;

/** Allows callers to omit protobuf defaults, matching generated codec inputs. */
export type FlightProtocolInput<T> =
  T extends FlightProtocolScalar ? T
    : T extends Array<infer Item> ? Array<FlightProtocolInput<Item>>
      : T extends ReadonlyArray<infer Item> ? ReadonlyArray<FlightProtocolInput<Item>>
        : T extends object ? { [Key in keyof T]?: FlightProtocolInput<T[Key]> }
          : T;

/** Stable low-level contract kept independent of generator-specific client types. */
export interface FlightRawClient {
  handshake(
    request: AsyncIterable<FlightProtocolInput<HandshakeRequest>>,
    options?: FlightRawCallOptions
  ): AsyncIterable<HandshakeResponse>

  listFlights(
    request: FlightProtocolInput<Criteria>,
    options?: FlightRawCallOptions
  ): AsyncIterable<FlightInfo>

  getFlightInfo(
    request: FlightProtocolInput<FlightDescriptor>,
    options?: FlightRawCallOptions
  ): Promise<FlightInfo>

  pollFlightInfo(
    request: FlightProtocolInput<FlightDescriptor>,
    options?: FlightRawCallOptions
  ): Promise<PollInfo>

  getSchema(
    request: FlightProtocolInput<FlightDescriptor>,
    options?: FlightRawCallOptions
  ): Promise<SchemaResult>

  doGet(
    request: FlightProtocolInput<Ticket>,
    options?: FlightRawCallOptions
  ): AsyncIterable<FlightData>

  doPut(
    request: AsyncIterable<FlightProtocolInput<FlightData>>,
    options?: FlightRawCallOptions
  ): AsyncIterable<PutResult>

  doExchange(
    request: AsyncIterable<FlightProtocolInput<FlightData>>,
    options?: FlightRawCallOptions
  ): AsyncIterable<FlightData>

  doAction(
    request: FlightProtocolInput<Action>,
    options?: FlightRawCallOptions
  ): AsyncIterable<Result>

  listActions(
    request: FlightProtocolInput<Empty>,
    options?: FlightRawCallOptions
  ): AsyncIterable<ActionType>
}
