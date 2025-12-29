import { tableFromIPC } from 'apache-arrow';
import type { FlightClient } from './flight-client';
import { Ticket } from '../generated/Flight';

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
export async function doGetTable(client: FlightClient, ticket: Uint8Array) {
  const request: Ticket = {
    ticket: Buffer.from(ticket)
  };

  const stream = client.grpc.doGet(request);
  const chunks: Buffer[] = [];

  for await (const message of stream) {
    if (message.dataBody) {
      chunks.push(message.dataBody);
    }
  }

  return tableFromIPC(
    Buffer.concat(chunks)
  );
}
