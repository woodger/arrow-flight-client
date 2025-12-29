import { tableFromIPC } from 'apache-arrow';
import type { FlightClient } from './flight-client';
import { Ticket } from '../generated/Flight';

export async function doGetTable(
  client: FlightClient,
  ticket: Uint8Array
) {
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

  return tableFromIPC(Buffer.concat(chunks));
}
