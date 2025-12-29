import { FlightClient, listFlights } from '../src';
import {
  RecordBatchReader,
  MessageReader
} from 'apache-arrow';

async function main() {
  const client = new FlightClient('localhost:8815');
  const flights = await listFlights(client);

  const ticket = flights[0].endpoint![0].ticket!.ticket!;
  const stream = client.grpc.doGet({ ticket });

  const messageReader = new MessageReader();

  for await (const flightData of stream) {
    if (!flightData.dataHeader || !flightData.dataBody) {
      continue;
    }

    const message = messageReader.readMessage(
      flightData.dataHeader,
      flightData.dataBody
    );

    if (message?.isRecordBatch()) {
      const batch = message.body;
      console.log('Batch rows:', batch.length);
    }
  }

  await client.close();
}

main().catch(console.error);
