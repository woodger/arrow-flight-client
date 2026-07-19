export { FlightClient } from './client/flight-client';
export * as flightProtocol from './flight-protocol';
export type { FlightStreamReader } from './client/flight-stream-reader';
export { FlightProtocolError } from './client/ipc';
export {
  commandDescriptor,
  pathDescriptor
} from './client/types';
export type {
  FlightAction,
  FlightActionResult,
  FlightActionType,
  FlightCallOptions,
  FlightClientOptions,
  FlightCommandDescriptor,
  FlightDataSource,
  FlightDescriptor,
  FlightEndpoint,
  FlightInfo,
  FlightMetadata,
  FlightMetadataValue,
  FlightPathDescriptor,
  FlightPollInfo,
  FlightPutOptions,
  FlightPutResult,
  FlightStreamChunk,
  FlightTicket,
  FlightTlsOptions
} from './client/types';
export { doGetTable } from './client/do-get';
export { doPutTable } from './client/do-put';
export { listFlights, getFlightInfo } from './client/actions';
