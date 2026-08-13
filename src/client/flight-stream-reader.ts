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
import {
  decodeFlightData,
  decodeFlightIpcMessage,
  FlightProtocolError
} from './ipc';
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
  private readonly prefetched: FlightData[] = [];
  private readonly source: AsyncIterable<FlightData>;
  private eventAvailable = Promise.resolve();
  private eventIndex = 0;
  private notifyEventAvailable: (() => void) | undefined;
  private reader: RecordBatchReader | undefined;
  private sourceIterator: AsyncIterator<FlightData> | undefined;
  private streamSchema: Schema | undefined;
  private reading = false;
  private finished = false;

  constructor(source: AsyncIterable<FlightData>, onFinish: () => void) {
    this.source = source;
    this.onFinish = onFinish;
    this.resetEventSignal();
  }

  get schema(): Schema {
    if (!this.streamSchema) {
      throw new Error('The Flight stream has not been opened');
    }

    return this.streamSchema;
  }

  async open(): Promise<this> {
    const iterator = this.source[Symbol.asyncIterator]();
    this.sourceIterator = iterator;

    try {
      while (true) {
        const next = await iterator.next();

        if (next.done) {
          throw new FlightProtocolError(
            'The Flight response does not contain an Arrow schema'
          );
        }

        this.prefetched.push(next.value);
        const message = decodeFlightIpcMessage(next.value);

        if (!message) {
          continue;
        }
        if (!message.isSchema()) {
          throw new FlightProtocolError(
            'The Flight response must begin with an Arrow schema'
          );
        }

        this.streamSchema = message.header();
        return this;
      }
    }
    catch (error) {
      try {
        await iterator.return?.();
      }
      finally {
        this.finish();
      }
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
      if (this.reader) {
        await this.reader.cancel();
      }
      else {
        await this.sourceIterator?.return?.();
      }
    }
    finally {
      this.finish();
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<FlightStreamChunk> {
    if (!this.sourceIterator) {
      throw new Error('The Flight stream has not been opened');
    }
    if (this.reading || this.finished) {
      throw new Error('A Flight stream can only be consumed once');
    }

    this.reading = true;
    const opening = this.openArrowReader();
    const openingOutcome = opening.then(
      (reader) => ({ type: 'reader' as const, reader }),
      (error: unknown) => ({ type: 'error' as const, error })
    );
    let reader: RecordBatchReader | undefined;

    try {
      while (!reader) {
        const event = this.peekEvent();

        if (event?.type === 'metadata') {
          this.takeEvent();
          yield {
            data: null,
            ...(event.appMetadata ? { appMetadata: event.appMetadata } : {})
          };
          continue;
        }

        const outcome = event?.type === 'batch'
          ? await openingOutcome
          : await Promise.race([
            openingOutcome,
            this.eventAvailable.then(() => ({ type: 'event' as const }))
          ]);

        if (outcome.type === 'event') {
          continue;
        }
        if (outcome.type === 'error') {
          throw outcome.error;
        }

        reader = outcome.reader;
      }

      const openedReader = reader[Symbol.asyncIterator]();
      const readNext = () => {
        const next = Promise.resolve(openedReader.next());
        const outcome = next.then(
          (result) => ({ type: 'reader' as const, result }),
          (error: unknown) => ({ type: 'error' as const, error })
        );

        return { next, outcome };
      };
      let pending: ReturnType<typeof readNext> | undefined;
      const ensurePending = () => {
        pending ??= readNext();
        return pending;
      };

      while (true) {
        const event = this.peekEvent();

        if (event?.type === 'metadata') {
          this.takeEvent();
          yield {
            data: null,
            ...(event.appMetadata ? { appMetadata: event.appMetadata } : {})
          };
          continue;
        }

        if (event?.type === 'batch') {
          const next = await ensurePending().next;

          if (next.done) {
            throw new FlightProtocolError(
              'FlightData contains a record batch that Arrow did not produce'
            );
          }

          this.takeEvent();
          yield {
            data: next.value,
            ...(event.appMetadata ? { appMetadata: event.appMetadata } : {})
          };
          pending = undefined;
          continue;
        }

        const outcome = await Promise.race([
          ensurePending().outcome,
          this.eventAvailable.then(() => ({ type: 'event' as const }))
        ]);

        if (outcome.type === 'event') {
          continue;
        }
        if (outcome.type === 'error') {
          throw outcome.error;
        }
        if (outcome.result.done) {
          return;
        }

        // Arrow emits an internal zero-row placeholder for a schema-only stream;
        // it has no corresponding FlightData batch and must not reach callers.
        if (outcome.result.value.numRows !== 0) {
          throw new FlightProtocolError(
            'Arrow produced a record batch without a matching FlightData message'
          );
        }

        pending = undefined;
      }
    }
    finally {
      if (!this.finished) {
        try {
          if (this.reader) {
            await this.reader.cancel();
          }
          else {
            await this.sourceIterator.return?.();
          }
        }
        finally {
          this.finish();
        }
      }
    }
  }

  private pushEvent(event: FlightIpcEvent): void {
    const wasEmpty = this.eventIndex === this.events.length;

    if (wasEmpty) {
      this.events.length = 0;
      this.eventIndex = 0;
    }

    this.events.push(event);

    if (wasEmpty) {
      this.notifyEventAvailable?.();
      this.notifyEventAvailable = undefined;
    }
  }

  private peekEvent(): FlightIpcEvent | undefined {
    return this.events[this.eventIndex];
  }

  private takeEvent(): void {
    this.eventIndex++;

    if (this.eventIndex === this.events.length) {
      this.events.length = 0;
      this.eventIndex = 0;
      this.resetEventSignal();
    }
  }

  private resetEventSignal(): void {
    this.eventAvailable = new Promise((resolve) => {
      this.notifyEventAvailable = resolve;
    });
  }

  private async openArrowReader(): Promise<RecordBatchReader> {
    const reader = await RecordBatchReader.from(
      decodeFlightData(this.replaySource(), (event) => this.pushEvent(event))
    );

    this.reader = reader;
    await reader.open();
    return reader;
  }

  private async *replaySource(): AsyncIterable<FlightData> {
    const iterator = this.sourceIterator;

    if (!iterator) {
      throw new Error('The Flight stream has not been opened');
    }

    try {
      yield* this.prefetched.splice(0);

      while (true) {
        const next = await iterator.next();

        if (next.done) {
          return;
        }

        yield next.value;
      }
    }
    finally {
      this.prefetched.length = 0;
      await iterator.return?.();
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
