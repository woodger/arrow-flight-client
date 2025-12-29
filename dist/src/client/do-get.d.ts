import type { FlightClient } from './flight-client';
/**
 * Выполняет doGet запрос к Flight-серверу.
 * @param ticket - объект Ticket, содержащий идентификатор набора данных.
 * @returns AsyncIterable<FlightData> — поток данных FlightData.
 *
 * Пример:
 * ```ts
 * for await (const batch of client.grpc.doGet(ticket)) {
 *   console.log(batch);
 * }
 * ```
 */
export declare function doGetTable(client: FlightClient, ticket: Uint8Array): Promise<import("apache-arrow").Table<any>>;
