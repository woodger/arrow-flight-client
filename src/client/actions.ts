import type { FlightClient } from './flight-client';
import { Empty, FlightDescriptor } from '../generated/Flight';

export async function listFlights(client: FlightClient) {
  const result = [];

  for await (const flight of client.grpc.listFlights({} as Empty)) {
    result.push(flight)
  }

  return result;
}

export async function getFlightInfo(
  client: FlightClient,
  descriptor: FlightDescriptor
) {
  return client.grpc.getFlightInfo(descriptor);
}
