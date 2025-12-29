import { tableToIPC } from 'apache-arrow';
import type { FlightClient } from './flight-client';
import {
  FlightDescriptor,
  FlightDescriptor_DescriptorType,
  FlightData
} from '../generated/Flight';

/**
 * Выполняет doPut запрос к Flight-серверу.
 * Позволяет отправлять данные на сервер в виде FlightData.
 * @param data - объект FlightData для отправки.
 * @returns AsyncIterableIterator<void> — поток для записи данных.
 *
 * Пример:
 * ```ts
 * const stream = client.grpc.doPut();
 * await stream.write(flightData);
 * await stream.end();
 * ```
 */

export async function doPutTable(client: FlightClient, table, path: string[]) {
  const descriptor: FlightDescriptor = {
    type: FlightDescriptor_DescriptorType.PATH,
    path,
    cmd: Buffer.alloc(0)
  };

  const writer = client.grpc.doPut();
  const ipc = tableToIPC(table);

  const data: FlightData = {
    flightDescriptor: descriptor,
    dataHeader: Buffer.alloc(0),
    dataBody: Buffer.from(ipc),
    appMetadata: Buffer.alloc(0)
  };

  await writer.write(data);
  await writer.end();
}
