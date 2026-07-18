/**
 * The Flight stream reader exposes decoded batches without losing Flight metadata.
 *
 * Allowed here:
 * - opening an Arrow reader over a FlightData stream;
 * - pairing record batches with their application metadata;
 * - owning stream consumption and cancellation state.
 *
 * This file must not own the client channel or construct Flight requests.
 */

import { RecordBatchReader, Table } from 'apache-arrow';
import type { RecordBatch, Schema } from 'apache-arrow';
import type { FlightData } from '../generated/Flight';
import { decodeFlightData, FlightProtocolError } from './ipc';
import type { FlightIpcEvent } from './ipc';
import type { FlightStreamChunk } from './types';

export interface FlightStreamReader extends AsyncIterable<FlightStreamChunk> {
  readonly schema: Schema
  readAll(): Promise<Table>
  cancel(): Promise<void>
}

class DefaultFlightStreamReader implements FlightStreamReader {
  private readonly events: FlightIpcEvent[] = [];
  private readonly onFinish: () => void;
  private readonly source: AsyncIterable<FlightData>;
  private reader: RecordBatchReader | undefined;
  private streamSchema: Schema | undefined;
  private reading = false;
  private finished = false;

  constructor(source: AsyncIterable<FlightData>, onFinish: () => void) {
    this.source = source;
    this.onFinish = onFinish;
  }

  get schema(): Schema {
    if (!this.streamSchema) {
      throw new Error('The Flight stream has not been opened');
    }

    return this.streamSchema;
  }

  async open(): Promise<this> {
    try {
      this.reader = await RecordBatchReader.from(
        decodeFlightData(this.source, (event) => this.events.push(event))
      );
      // Arrow selects an async reader in from(), but the schema is unavailable
      // until that reader explicitly opens the source.
      await this.reader.open();
      this.streamSchema = this.reader.schema;
      return this;
    }
    catch (error) {
      this.finish();
      throw error;
    }
  }

  async readAll(): Promise<Table> {
    const batches: RecordBatch[] = [];

    for await (const chunk of this) {
      if (chunk.data) {
        batches.push(chunk.data);
      }
    }

    return new Table(this.schema, batches);
  }

  async cancel(): Promise<void> {
    try {
      await this.reader?.cancel();
    }
    finally {
      this.finish();
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<FlightStreamChunk> {
    if (!this.reader) {
      throw new Error('The Flight stream has not been opened');
    }
    if (this.reading || this.finished) {
      throw new Error('A Flight stream can only be consumed once');
    }

    this.reading = true;

    try {
      while (true) {
        const next = await this.reader.next();

        if (next.done) {
          yield* this.takeTrailingMetadata();
          return;
        }

        let matchedBatch = false;

        while (this.events.length !== 0) {
          const event = this.events.shift();

          if (!event) {
            break;
          }

          if (event.type === 'batch') {
            matchedBatch = true;
            yield {
              data: next.value,
              ...(event.appMetadata ? { appMetadata: event.appMetadata } : {})
            };
            break;
          }

          yield {
            data: null,
            ...(event.appMetadata ? { appMetadata: event.appMetadata } : {})
          };
        }

        // Arrow emits an internal zero-row placeholder for a schema-only stream;
        // it has no corresponding FlightData batch and must not reach callers.
        if (!matchedBatch && next.value.numRows !== 0) {
          throw new FlightProtocolError(
            'Arrow produced a record batch without a matching FlightData message'
          );
        }
      }
    }
    finally {
      if (!this.finished) {
        await this.reader.cancel();
        this.finish();
      }
    }
  }

  private *takeTrailingMetadata(): Iterable<FlightStreamChunk> {
    for (const event of this.events.splice(0)) {
      if (event.type === 'metadata') {
        yield {
          data: null,
          ...(event.appMetadata ? { appMetadata: event.appMetadata } : {})
        };
      }
    }
  }

  private finish(): void {
    if (!this.finished) {
      this.finished = true;
      this.onFinish();
    }
  }
}

export async function createFlightStreamReader(
  source: AsyncIterable<FlightData>,
  onFinish: () => void
): Promise<FlightStreamReader> {
  return new DefaultFlightStreamReader(source, onFinish).open();
}
