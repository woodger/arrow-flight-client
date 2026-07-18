/**
 * FlightClient is the public transport facade for Apache Arrow Flight.
 *
 * Allowed here:
 * - owning the gRPC channel lifecycle;
 * - mapping public call options to nice-grpc calls;
 * - exposing protocol operations through project-owned inputs and outputs.
 *
 * This file must not implement Arrow IPC framing or generated type conversion.
 */

import { credentials } from '@grpc/grpc-js';
import {
  createChannel,
  createClientFactory,
  type Channel,
  type ChannelOptions,
  type Client
} from 'nice-grpc';
import type { CallOptions } from 'nice-grpc';
import { Metadata } from 'nice-grpc-common';
import type { Schema, Table } from 'apache-arrow';
import { FlightServiceDefinition } from '../generated/Flight';
import { createFlightStreamReader } from './flight-stream-reader';
import type { FlightStreamReader } from './flight-stream-reader';
import { encodeFlightData } from './ipc';
import { metadataMiddleware } from './metadata-middleware';
import {
  decodeFlightInfo,
  decodePollInfo,
  decodeSchema,
  encodeAction,
  encodeDescriptor
} from './protocol';
import type {
  FlightAction,
  FlightActionResult,
  FlightActionType,
  FlightCallOptions,
  FlightClientOptions,
  FlightDataSource,
  FlightDescriptor,
  FlightInfo,
  FlightMetadata,
  FlightPollInfo,
  FlightPutOptions,
  FlightPutResult,
  FlightTicket
} from './types';

export type FlightGrpcClient = Client<typeof FlightServiceDefinition>;

interface PreparedCall {
  readonly options: CallOptions
  readonly dispose: () => void
}

export class FlightClient {
  private readonly channel: Channel;
  private readonly client: FlightGrpcClient;
  private closed = false;
  private closePromise: Promise<void> | undefined;

  constructor(address: string, options: FlightClientOptions = {}) {
    const channelCredentials = createCredentials(options);
    const channelOptions: ChannelOptions = {};

    if (options.maxReceiveMessageLength !== undefined) {
      channelOptions['grpc.max_receive_message_length'] =
        options.maxReceiveMessageLength;
    }
    if (options.maxSendMessageLength !== undefined) {
      channelOptions['grpc.max_send_message_length'] =
        options.maxSendMessageLength;
    }

    this.channel = createChannel(
      address,
      channelCredentials,
      channelOptions
    );
    const clientFactory = options.metadata
      ? createClientFactory().use(metadataMiddleware(options.metadata))
      : createClientFactory();

    this.client = clientFactory.create(FlightServiceDefinition, this.channel);
  }

  /** Low-level generated client for protocol extensions not covered by this facade. */
  get raw(): FlightGrpcClient {
    return this.client;
  }

  /** @deprecated Use `raw` for explicit low-level access. */
  get grpc(): FlightGrpcClient {
    return this.raw;
  }

  listFlights(
    criteria: Uint8Array = new Uint8Array(0),
    options: FlightCallOptions = {}
  ): AsyncIterable<FlightInfo> {
    this.assertOpen();
    const call = prepareCall(options);

    try {
      return mapStream(
        this.client.listFlights(
          { expression: Buffer.from(criteria) },
          call.options
        ),
        decodeFlightInfo,
        call.dispose
      );
    }
    catch (error) {
      call.dispose();
      throw error;
    }
  }

  async getFlightInfo(
    descriptor: FlightDescriptor,
    options: FlightCallOptions = {}
  ): Promise<FlightInfo> {
    this.assertOpen();
    const call = prepareCall(options);

    try {
      return decodeFlightInfo(
        await this.client.getFlightInfo(
          encodeDescriptor(descriptor),
          call.options
        )
      );
    }
    finally {
      call.dispose();
    }
  }

  async pollFlightInfo(
    descriptor: FlightDescriptor,
    options: FlightCallOptions = {}
  ): Promise<FlightPollInfo> {
    this.assertOpen();
    const call = prepareCall(options);

    try {
      return decodePollInfo(
        await this.client.pollFlightInfo(
          encodeDescriptor(descriptor),
          call.options
        )
      );
    }
    finally {
      call.dispose();
    }
  }

  async getSchema(
    descriptor: FlightDescriptor,
    options: FlightCallOptions = {}
  ): Promise<Schema> {
    this.assertOpen();
    const call = prepareCall(options);

    try {
      const result = await this.client.getSchema(
        encodeDescriptor(descriptor),
        call.options
      );
      return decodeSchema(result.schema);
    }
    finally {
      call.dispose();
    }
  }

  async doGet(
    ticket: FlightTicket,
    options: FlightCallOptions = {}
  ): Promise<FlightStreamReader> {
    this.assertOpen();
    const call = prepareCall(options);

    try {
      return await createFlightStreamReader(
        this.client.doGet({ ticket: Buffer.from(ticket) }, call.options),
        call.dispose
      );
    }
    catch (error) {
      call.dispose();
      throw error;
    }
  }

  async getTable(
    ticket: FlightTicket,
    options: FlightCallOptions = {}
  ): Promise<Table> {
    const reader = await this.doGet(ticket, options);
    return reader.readAll();
  }

  doPut(
    descriptor: FlightDescriptor,
    source: FlightDataSource,
    options: FlightPutOptions = {}
  ): AsyncIterable<FlightPutResult> {
    this.assertOpen();
    const call = prepareCall(options);
    const requests = encodeFlightData(
      encodeDescriptor(descriptor),
      source,
      {
        ...(options.schema ? { schema: options.schema } : {}),
        ...(options.appMetadata ? { appMetadata: options.appMetadata } : {})
      }
    );

    try {
      return mapStream(
        this.client.doPut(requests, call.options),
        (result) => ({ appMetadata: Uint8Array.from(result.appMetadata) }),
        call.dispose
      );
    }
    catch (error) {
      call.dispose();
      throw error;
    }
  }

  async putTable(
    descriptor: FlightDescriptor,
    table: Table,
    options: FlightPutOptions = {}
  ): Promise<readonly FlightPutResult[]> {
    const results: FlightPutResult[] = [];

    for await (const result of this.doPut(descriptor, table, options)) {
      results.push(result);
    }

    return results;
  }

  doAction(
    action: FlightAction,
    options: FlightCallOptions = {}
  ): AsyncIterable<FlightActionResult> {
    this.assertOpen();
    const call = prepareCall(options);

    try {
      return mapStream(
        this.client.doAction(encodeAction(action), call.options),
        (result) => ({ body: Uint8Array.from(result.body) }),
        call.dispose
      );
    }
    catch (error) {
      call.dispose();
      throw error;
    }
  }

  listActions(
    options: FlightCallOptions = {}
  ): AsyncIterable<FlightActionType> {
    this.assertOpen();
    const call = prepareCall(options);

    try {
      return mapStream(
        this.client.listActions({}, call.options),
        ({ type, description }) => ({ type, description }),
        call.dispose
      );
    }
    catch (error) {
      call.dispose();
      throw error;
    }
  }

  close(): Promise<void> {
    if (!this.closePromise) {
      this.closed = true;
      this.closePromise = Promise.resolve().then(() => this.channel.close());
    }

    return this.closePromise;
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('FlightClient is closed');
    }
  }
}

function createCredentials(options: FlightClientOptions) {
  if (!options.tls) {
    return credentials.createInsecure();
  }

  if (options.tls === true) {
    return credentials.createSsl();
  }

  const { rootCertificates, privateKey, certificateChain } = options.tls;

  if ((privateKey && !certificateChain) || (!privateKey && certificateChain)) {
    throw new TypeError(
      'TLS privateKey and certificateChain must be provided together'
    );
  }

  return credentials.createSsl(
    rootCertificates ? Buffer.from(rootCertificates) : undefined,
    privateKey ? Buffer.from(privateKey) : undefined,
    certificateChain ? Buffer.from(certificateChain) : undefined
  );
}

function prepareCall(options: FlightCallOptions): PreparedCall {
  const callOptions: CallOptions = {};
  const metadata = options.metadata
    ? createMetadata(options.metadata)
    : undefined;
  const preparedSignal = prepareSignal(options.signal, options.deadline);

  if (metadata) {
    callOptions.metadata = metadata;
  }
  if (preparedSignal.signal) {
    callOptions.signal = preparedSignal.signal;
  }

  return { options: callOptions, dispose: preparedSignal.dispose };
}

function createMetadata(headers: FlightMetadata): Metadata {
  const metadata = new Metadata();

  for (const [key, value] of Object.entries(headers)) {
    const values = Array.isArray(value) ? value : [value];

    for (const item of values) {
      metadata.append(key, item);
    }
  }

  return metadata;
}

function prepareSignal(
  signal: AbortSignal | undefined,
  deadline: Date | undefined
): { readonly signal?: AbortSignal; readonly dispose: () => void } {
  if (!deadline) {
    return {
      ...(signal ? { signal } : {}),
      dispose: () => undefined
    };
  }

  const deadlineTime = deadline.getTime();

  if (!Number.isFinite(deadlineTime)) {
    throw new RangeError('Flight call deadline must be a valid Date');
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, Math.max(0, deadlineTime - Date.now()));
  timeout.unref();

  if (signal?.aborted) {
    controller.abort();
  }
  else {
    signal?.addEventListener('abort', abort, { once: true });
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  };
}

function mapStream<TInput, TOutput>(
  source: AsyncIterable<TInput>,
  map: (value: TInput) => TOutput,
  dispose: () => void
): AsyncIterable<TOutput> {
  return {
    async *[Symbol.asyncIterator]() {
      try {
        for await (const value of source) {
          yield map(value);
        }
      }
      finally {
        dispose();
      }
    }
  };
}
