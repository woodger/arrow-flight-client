import type { FlightClient } from './flight-client';
import { Empty, FlightDescriptor } from '../generated/Flight';

/**
 * Получает список всех доступных Flight-сессий на сервере.
 *
 * Выполняет вызов `listFlights` на gRPC-сервере и собирает результаты в массив.
 *
 * @param client - Экземпляр FlightClient
 * @returns Promise<Array<FlightInfo>> — массив объектов FlightInfo
 *
 * Пример использования:
 * ```ts
 * const flights = await listFlights(client);
 * console.log(flights);
 * ```
 */
export async function listFlights(client: FlightClient) {
  const result = [];

  for await (const flight of client.grpc.listFlights({} as Empty)) {
    result.push(flight)
  }

  return result;
}

/**
 * Получает информацию о конкретном Flight по FlightDescriptor.
 *
 * Выполняет вызов `getFlightInfo` на сервере с заданным дескриптором.
 *
 * @param client - Экземпляр FlightClient
 * @param descriptor - FlightDescriptor, описывающий нужный Flight
 * @returns Promise<FlightInfo> — объект FlightInfo с информацией о Flight
 *
 * Пример использования:
 * ```ts
 * const descriptor = { type: FlightDescriptor_DescriptorType.PATH, path: ['example'] };
 * const info = await getFlightInfo(client, descriptor);
 * console.log(info);
 * ```
 */
export async function getFlightInfo(client: FlightClient, descriptor: FlightDescriptor) {
  return client.grpc.getFlightInfo(descriptor);
}
