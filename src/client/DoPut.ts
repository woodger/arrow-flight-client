import { tableToIPC } from 'apache-arrow'
import type { FlightClient } from './FlightClient'
import { FlightDescriptor, FlightData } from '../generated/Flight'

export async function doPutTable(
  client: FlightClient,
  table,
  path: string[]
) {
  const descriptor: FlightDescriptor = {
    type: 'PATH',
    path
  }

  const writer = client.grpc.doPut()

  const ipc = tableToIPC(table)

  const data: FlightData = {
    flightDescriptor: descriptor,
    dataBody: ipc
  }

  await writer.write(data)
  await writer.end()
}
