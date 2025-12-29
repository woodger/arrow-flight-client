import { tableFromIPC } from 'apache-arrow'
import type { FlightClient } from './FlightClient'
import { Ticket } from '../generated/Flight'

export async function doGetTable(
  client: FlightClient,
  ticket: Uint8Array
) {
  const request: Ticket = {
    ticket
  }

  const stream = client.grpc.doGet(request)

  const chunks: Uint8Array[] = []

  for await (const message of stream) {
    if (message.dataBody) {
      chunks.push(message.dataBody)
    }
  }

  const buffer = Buffer.concat(chunks)
  return tableFromIPC(buffer)
}
