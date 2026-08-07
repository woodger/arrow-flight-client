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
  ClientError,
  createChannel,
  createClientFactory,
  Status,
  type Channel,
  type ChannelOptions
} from 'nice-grpc';
import type { CallOptions } from 'nice-grpc';
import { Metadata } from 'nice-grpc-common';
import type { Schema, Table } from 'apache-arrow';
import { FlightServiceDefinition } from '../generated/Flight';
import type { FlightRawClient } from '../flight-protocol';
import { createFlightStreamReader } from './flight-stream-reader';
import type { FlightStreamReader } from './flight-stream-reader';
import { encodeFlightData } from './ipc';
import {
  metadataMiddleware,
  setMetadataOverrideKeys
} from './metadata-middleware';
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

interface PreparedCall {
  readonly options: CallOptions
  readonly dispose: () => void
  readonly ensureActive: () => void
  readonly normalizeError: (error: unknown) => unknown
}

type FlightMethodName = keyof typeof FlightServiceDefinition.methods;

export class FlightClient {
  private readonly channel: Channel;
  private readonly client: FlightRawClient;
  private readonly callDisposers = new Set<() => void>();
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

  /** Escape hatch for unsupported operations on the client-owned channel. */
  get raw(): FlightRawClient {
    return this.client;
  }

  /** @deprecated Use `raw` for explicit low-level access. */
  get grpc(): FlightRawClient {
    return this.raw;
  }

  listFlights(
    criteria: Uint8Array = new Uint8Array(0),
    options: FlightCallOptions = {}
  ): AsyncIterable<FlightInfo> {
    this.assertOpen();
    const callOptions = snapshotCallOptions(options);
    const request = { expression: Buffer.from(criteria) };

    return this.createStream(
      callOptions,
      'listFlights',
      (preparedOptions) => this.client.listFlights(request, preparedOptions),
      decodeFlightInfo
    );
  }

  async getFlightInfo(
    descriptor: FlightDescriptor,
    options: FlightCallOptions = {}
  ): Promise<FlightInfo> {
    this.assertOpen();
    const call = this.prepareCall(options, 'getFlightInfo');

    try {
      return decodeFlightInfo(
        await this.client.getFlightInfo(
          encodeDescriptor(descriptor),
          call.options
        )
      );
    }
    catch (error) {
      throw call.normalizeError(error);
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
    const call = this.prepareCall(options, 'pollFlightInfo');

    try {
      return decodePollInfo(
        await this.client.pollFlightInfo(
          encodeDescriptor(descriptor),
          call.options
        )
      );
    }
    catch (error) {
      throw call.normalizeError(error);
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
    const call = this.prepareCall(options, 'getSchema');

    try {
      const result = await this.client.getSchema(
        encodeDescriptor(descriptor),
        call.options
      );
      return decodeSchema(result.schema);
    }
    catch (error) {
      throw call.normalizeError(error);
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
    const call = this.prepareCall(options, 'doGet');

    try {
      return await createFlightStreamReader(
        normalizeStreamErrors(
          this.client.doGet(
            { ticket: Buffer.from(ticket) },
            call.options
          ),
          call.ensureActive,
          call.normalizeError
        ),
        call.dispose
      );
    }
    catch (error) {
      call.dispose();
      throw call.normalizeError(error);
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
    const callOptions = snapshotCallOptions(options);
    const requests = encodeFlightData(
      encodeDescriptor(descriptor),
      source,
      {
        ...(options.schema ? { schema: options.schema } : {}),
        ...(options.appMetadata ? { appMetadata: options.appMetadata } : {})
      }
    );

    return this.createStream(
      callOptions,
      'doPut',
      (preparedOptions) => this.client.doPut(requests, preparedOptions),
      (result) => ({ appMetadata: Uint8Array.from(result.appMetadata) })
    );
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
    const callOptions = snapshotCallOptions(options);
    const request = encodeAction(action);

    return this.createStream(
      callOptions,
      'doAction',
      (preparedOptions) => this.client.doAction(request, preparedOptions),
      (result) => ({ body: Uint8Array.from(result.body) })
    );
  }

  listActions(
    options: FlightCallOptions = {}
  ): AsyncIterable<FlightActionType> {
    this.assertOpen();
    const callOptions = snapshotCallOptions(options);

    return this.createStream(
      callOptions,
      'listActions',
      (preparedOptions) => this.client.listActions({}, preparedOptions),
      ({ type, description }) => ({ type, description })
    );
  }

  close(): Promise<void> {
    if (!this.closePromise) {
      this.closed = true;

      for (const dispose of [...this.callDisposers]) {
        dispose();
      }

      this.closePromise = Promise.resolve().then(() => this.channel.close());
    }

    return this.closePromise;
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('FlightClient is closed');
    }
  }

  private createStream<TInput, TOutput>(
    options: FlightCallOptions,
    methodName: FlightMethodName,
    createSource: (options: CallOptions) => AsyncIterable<TInput>,
    map: (value: TInput) => TOutput
  ): AsyncIterable<TOutput> {
    return mapStream(
      () => {
        this.assertOpen();
        const call = this.prepareCall(options, methodName);

        try {
          return {
            source: normalizeStreamErrors(
              createSource(call.options),
              call.ensureActive,
              call.normalizeError
            ),
            dispose: call.dispose
          };
        }
        catch (error) {
          call.dispose();
          throw call.normalizeError(error);
        }
      },
      map
    );
  }

  private prepareCall(
    options: FlightCallOptions,
    methodName: FlightMethodName
  ): PreparedCall {
    const prepared = prepareCall(options, methodName);
    const managedSignal = options.deadline
      ? prepared.options.signal
      : undefined;
    let disposed = false;
    const dispose = () => {
      if (!disposed) {
        disposed = true;
        managedSignal?.removeEventListener('abort', dispose);
        prepared.dispose();
        this.callDisposers.delete(dispose);
      }
    };

    this.callDisposers.add(dispose);
    managedSignal?.addEventListener('abort', dispose, { once: true });

    if (managedSignal?.aborted) {
      dispose();
    }

    return {
      ...prepared,
      dispose
    };
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

function prepareCall(
  options: FlightCallOptions,
  methodName: FlightMethodName
): PreparedCall {
  const callOptions: CallOptions = {};
  const metadata = options.metadata
    ? createMetadata(options.metadata)
    : undefined;
  const preparedSignal = prepareSignal(options.signal, options.deadline);

  if (metadata) {
    callOptions.metadata = metadata;
    setMetadataOverrideKeys(callOptions, options.metadata ?? {});
  }
  if (preparedSignal.signal) {
    callOptions.signal = preparedSignal.signal;
  }

  const normalizeError = (error: unknown): unknown => {
    if (!preparedSignal.deadlineExceeded() || !isAbortError(error)) {
      return error;
    }

    const method = FlightServiceDefinition.methods[methodName];
    return new ClientError(
      `/${FlightServiceDefinition.fullName}/${method.name}`,
      Status.DEADLINE_EXCEEDED,
      'Deadline exceeded'
    );
  };

  return {
    options: callOptions,
    dispose: preparedSignal.dispose,
    ensureActive: () => {
      if (preparedSignal.signal?.aborted) {
        throw normalizeError(createAbortError());
      }
    },
    normalizeError
  };
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

function snapshotCallOptions(options: FlightCallOptions): FlightCallOptions {
  const deadline = options.deadline;
  let deadlineSnapshot: Date | undefined;

  if (deadline) {
    const deadlineTime = deadline.getTime();

    if (!Number.isFinite(deadlineTime)) {
      throw new RangeError('Flight call deadline must be a valid Date');
    }

    deadlineSnapshot = new Date(deadlineTime);
  }

  const metadata = options.metadata
    ? Object.fromEntries(
      Object.entries(options.metadata).map(([key, value]) => [
        key,
        Array.isArray(value) ? [...value] : value
      ])
    ) as FlightMetadata
    : undefined;

  if (metadata) {
    createMetadata(metadata);
  }

  return {
    ...(metadata ? { metadata } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    ...(deadlineSnapshot ? { deadline: deadlineSnapshot } : {})
  };
}

function prepareSignal(
  signal: AbortSignal | undefined,
  deadline: Date | undefined
): {
  readonly signal?: AbortSignal
  readonly dispose: () => void
  readonly deadlineExceeded: () => boolean
} {
  if (!deadline) {
    return {
      ...(signal ? { signal } : {}),
      dispose: () => undefined,
      deadlineExceeded: () => false
    };
  }

  const deadlineTime = deadline.getTime();

  if (!Number.isFinite(deadlineTime)) {
    throw new RangeError('Flight call deadline must be a valid Date');
  }

  const controller = new AbortController();
  let cancellationSource: 'caller' | 'deadline' | undefined;
  let timeout: NodeJS.Timeout | undefined;
  const clearDeadlineTimer = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
  };
  const abortForCaller = () => {
    if (!controller.signal.aborted) {
      cancellationSource = 'caller';
      clearDeadlineTimer();
      controller.abort();
    }
  };
  const abortForDeadline = () => {
    if (!controller.signal.aborted) {
      cancellationSource = 'deadline';
      signal?.removeEventListener('abort', abortForCaller);
      controller.abort();
    }
  };
  const scheduleDeadline = () => {
    const remaining = deadlineTime - Date.now();

    if (remaining <= 0) {
      abortForDeadline();
      return;
    }

    timeout = setTimeout(
      scheduleDeadline,
      Math.min(remaining, MAX_TIMEOUT_DELAY)
    );
    timeout.unref();
  };

  if (signal?.aborted) {
    abortForCaller();
  }
  else if (deadlineTime <= Date.now()) {
    abortForDeadline();
  }
  else {
    signal?.addEventListener('abort', abortForCaller, { once: true });
    scheduleDeadline();
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearDeadlineTimer();
      signal?.removeEventListener('abort', abortForCaller);
    },
    deadlineExceeded: () => cancellationSource === 'deadline'
  };
}

const MAX_TIMEOUT_DELAY = 2_147_483_647;

function isAbortError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'AbortError';
}

function createAbortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

function normalizeStreamErrors<T>(
  source: AsyncIterable<T>,
  ensureActive: () => void,
  normalizeError: (error: unknown) => unknown
): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      ensureActive();

      try {
        yield* source;
      }
      catch (error) {
        throw normalizeError(error);
      }
    }
  };
}

function mapStream<TInput, TOutput>(
  open: () => {
    readonly source: AsyncIterable<TInput>
    readonly dispose: () => void
  },
  map: (value: TInput) => TOutput
): AsyncIterable<TOutput> {
  return {
    async *[Symbol.asyncIterator]() {
      // Keep resource acquisition inside the generator body: return() before
      // the first next() skips this body and must leave no call resources.
      const { source, dispose } = open();

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
