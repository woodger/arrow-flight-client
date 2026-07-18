import { tableToIPC } from 'apache-arrow';
import type { Table } from 'apache-arrow';
import type { FlightClient } from './flight-client';
import {
  FlightDescriptor,
  FlightDescriptor_DescriptorType,
  FlightData
} from '../generated/Flight';

/**
 * Выполняет doPut запрос к Flight-серверу.
 * Позволяет отправлять данные на сервер в виде FlightData.
 * @param table - таблица Arrow для отправки.
 * @param path - путь FlightDescriptor для загружаемой таблицы.
 * @returns Promise<void>, который разрешается после завершения потока ответов.
 *
 * Пример:
 * ```ts
 * await doPutTable(client, table, ['example']);
 * ```
 */

export async function doPutTable(client: FlightClient, table: Table, path: string[]) {
  const descriptor: FlightDescriptor = {
    type: FlightDescriptor_DescriptorType.PATH,
    path,
    cmd: Buffer.alloc(0)
  };

  const ipc = tableToIPC(table);

  const data: FlightData = {
    flightDescriptor: descriptor,
    dataHeader: Buffer.alloc(0),
    dataBody: Buffer.from(ipc),
    appMetadata: Buffer.alloc(0)
  };

  async function* request() {
    yield data;
  }

  for await (const response of client.grpc.doPut(request())) {
    void response;
  }
}
