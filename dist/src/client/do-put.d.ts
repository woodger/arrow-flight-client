import type { FlightClient } from './flight-client';
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
export declare function doPutTable(client: FlightClient, table: any, path: string[]): Promise<void>;
