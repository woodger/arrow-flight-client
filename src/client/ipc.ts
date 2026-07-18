/**
 * The Flight IPC adapter translates between Arrow IPC streams and FlightData messages.
 *
 * Allowed here:
 * - separating IPC message metadata from record data for DoPut;
 * - restoring encapsulated IPC framing for DoGet;
 * - validating message body lengths and stream schemas.
 *
 * This file must not create gRPC channels or expose generated types publicly.
 */

import {
  Message,
  MessageReader,
  RecordBatch,
  Table,
  tableToIPC,
  util
} from 'apache-arrow';
import type { Schema } from 'apache-arrow';
import type {
  FlightData,
  FlightDescriptor as ProtocolFlightDescriptor
} from '../generated/Flight';
import type { FlightDataSource } from './types';

export class FlightProtocolError extends Error {
  override readonly name = 'FlightProtocolError';
}

export interface FlightIpcEvent {
  readonly type: 'batch' | 'metadata'
  readonly appMetadata?: Uint8Array
}

export interface EncodeFlightDataOptions {
  readonly schema?: Schema
  readonly appMetadata?: Uint8Array
}

export async function* encodeFlightData(
  descriptor: ProtocolFlightDescriptor,
  source: FlightDataSource,
  options: EncodeFlightDataOptions = {}
): AsyncIterable<FlightData> {
  let messageIndex = 0;

  const emitIpc = function* (
    ipc: Uint8Array,
    includeSchema: boolean
  ): Iterable<FlightData> {
    const reader = new MessageReader(ipc);
    let message = reader.readMessage();

    while (message) {
      const body = reader.readMessageBody(message.bodyLength);

      if (includeSchema || !message.isSchema()) {
        // Flight identifies a DoPut stream with a descriptor only on its first message.
        const firstMessage = messageIndex === 0;
        const appMetadata = firstMessage && options.appMetadata
          ? Buffer.from(options.appMetadata)
          : Buffer.alloc(0);

        yield {
          flightDescriptor: firstMessage ? descriptor : undefined,
          // MessageReader removes stream framing; Flight expects the raw flatbuffer here.
          dataHeader: Buffer.from(Message.encode(message)),
          appMetadata,
          dataBody: Buffer.from(body)
        };
        messageIndex++;
      }

      message = reader.readMessage();
    }
  };

  if (source instanceof Table) {
    yield* emitIpc(tableToIPC(source, 'stream'), true);
    return;
  }

  let schema = options.schema;
  let batchCount = 0;

  for await (const batch of source) {
    if (!(batch instanceof RecordBatch)) {
      throw new TypeError('DoPut sources must contain Arrow RecordBatch values');
    }

    if (!schema) {
      schema = batch.schema;
    }
    else if (!util.compareSchemas(schema, batch.schema)) {
      throw new FlightProtocolError('All DoPut record batches must use the same schema');
    }

    // Arrow JS exposes an IPC stream writer, but not a public Flight payload
    // encoder. Encode one batch at a time and omit repeated schema messages so
    // iterable uploads remain incremental.
    const table = new Table(schema, [batch]);
    yield* emitIpc(tableToIPC(table, 'stream'), batchCount === 0);
    batchCount++;
  }

  if (batchCount === 0) {
    if (!schema) {
      throw new FlightProtocolError(
        'An empty DoPut iterable requires FlightPutOptions.schema'
      );
    }

    yield* emitIpc(tableToIPC(new Table(schema, []), 'stream'), true);
  }
}

export async function* decodeFlightData(
  source: AsyncIterable<FlightData>,
  onEvent: (event: FlightIpcEvent) => void
): AsyncIterable<Uint8Array> {
  for await (const message of source) {
    if (message.dataHeader.byteLength === 0) {
      if (message.dataBody.byteLength !== 0) {
        throw new FlightProtocolError(
          'FlightData contains a data body without an IPC message header'
        );
      }

      if (message.appMetadata.byteLength !== 0) {
        onEvent({
          type: 'metadata',
          appMetadata: Uint8Array.from(message.appMetadata)
        });
      }

      continue;
    }

    const ipcMessage = Message.decode(message.dataHeader);

    if (ipcMessage.bodyLength !== message.dataBody.byteLength) {
      throw new FlightProtocolError(
        `FlightData body length ${message.dataBody.byteLength} does not match ` +
        `the IPC header length ${ipcMessage.bodyLength}`
      );
    }

    const appMetadata = message.appMetadata.byteLength === 0
      ? undefined
      : Uint8Array.from(message.appMetadata);

    if (ipcMessage.isRecordBatch()) {
      onEvent({ type: 'batch', ...(appMetadata ? { appMetadata } : {}) });
    }
    else if (appMetadata) {
      onEvent({ type: 'metadata', appMetadata });
    }

    yield encapsulateMessage(message.dataHeader);

    if (message.dataBody.byteLength !== 0) {
      yield message.dataBody;
    }
  }
}

function encapsulateMessage(dataHeader: Uint8Array): Uint8Array {
  // Flight removes the IPC continuation prefix and metadata length. Arrow's
  // stream reader requires both fields and metadata padded to 8-byte alignment.
  const paddingLength = (8 - dataHeader.byteLength % 8) % 8;
  const result = Buffer.alloc(8 + dataHeader.byteLength + paddingLength);

  result.writeInt32LE(-1, 0);
  result.writeInt32LE(dataHeader.byteLength + paddingLength, 4);
  Buffer.from(dataHeader).copy(result, 8);

  return result;
}
