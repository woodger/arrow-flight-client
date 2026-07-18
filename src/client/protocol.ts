/**
 * The protocol adapter isolates generated protobuf representations from the public API.
 *
 * Allowed here:
 * - converting public descriptors into generated requests;
 * - converting generated metadata responses into project-owned values;
 * - decoding schema fields carried in encapsulated Arrow IPC form.
 *
 * This file must not create channels or consume FlightData streams.
 */

import { MessageReader } from 'apache-arrow';
import type { Schema } from 'apache-arrow';
import {
  FlightDescriptor_DescriptorType,
  type Action,
  type FlightDescriptor as ProtocolFlightDescriptor,
  type FlightEndpoint as ProtocolFlightEndpoint,
  type FlightInfo as ProtocolFlightInfo,
  type PollInfo as ProtocolPollInfo
} from '../generated/Flight';
import type {
  FlightAction,
  FlightDescriptor,
  FlightEndpoint,
  FlightInfo,
  FlightPollInfo
} from './types';

export function encodeDescriptor(
  descriptor: FlightDescriptor
): ProtocolFlightDescriptor {
  if (descriptor.type === 'path') {
    return {
      type: FlightDescriptor_DescriptorType.PATH,
      path: [...descriptor.path],
      cmd: Buffer.alloc(0)
    };
  }

  return {
    type: FlightDescriptor_DescriptorType.CMD,
    path: [],
    cmd: Buffer.from(descriptor.command)
  };
}

export function decodeDescriptor(
  descriptor: ProtocolFlightDescriptor | undefined
): FlightDescriptor | undefined {
  if (descriptor?.type === FlightDescriptor_DescriptorType.PATH) {
    return { type: 'path', path: [...descriptor.path] };
  }

  if (descriptor?.type === FlightDescriptor_DescriptorType.CMD) {
    return { type: 'command', command: Uint8Array.from(descriptor.cmd) };
  }

  return undefined;
}

export function decodeSchema(schemaMessage: Uint8Array): Schema {
  const schema = new MessageReader(schemaMessage).readSchema(true);

  if (!schema) {
    throw new Error('The Flight response does not contain an Arrow schema');
  }

  return schema;
}

export function decodeFlightInfo(info: ProtocolFlightInfo): FlightInfo {
  const descriptor = decodeDescriptor(info.flightDescriptor);

  return {
    schema: decodeSchema(info.schema),
    ...(descriptor ? { descriptor } : {}),
    endpoints: info.endpoint.map(decodeFlightEndpoint),
    totalRecords: info.totalRecords,
    totalBytes: info.totalBytes,
    ordered: info.ordered,
    appMetadata: Uint8Array.from(info.appMetadata)
  };
}

export function decodePollInfo(info: ProtocolPollInfo): FlightPollInfo {
  const descriptor = decodeDescriptor(info.flightDescriptor);

  return {
    ...(info.info ? { info: decodeFlightInfo(info.info) } : {}),
    ...(descriptor ? { descriptor } : {}),
    ...(info.progress === undefined ? {} : { progress: info.progress }),
    ...(info.expirationTime ? { expirationTime: info.expirationTime } : {})
  };
}

export function encodeAction(action: FlightAction): Action {
  return {
    type: action.type,
    body: action.body ? Buffer.from(action.body) : Buffer.alloc(0)
  };
}

function decodeFlightEndpoint(endpoint: ProtocolFlightEndpoint): FlightEndpoint {
  return {
    ...(endpoint.ticket ? { ticket: Uint8Array.from(endpoint.ticket.ticket) } : {}),
    locations: endpoint.location.map(({ uri }) => uri),
    ...(endpoint.expirationTime ? { expirationTime: endpoint.expirationTime } : {}),
    appMetadata: Uint8Array.from(endpoint.appMetadata)
  };
}
