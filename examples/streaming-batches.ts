import { FlightClient, listFlights } from '../src';
import { RecordBatchReader } from 'apache-arrow';

async function main() {
  const client = new FlightClient('localhost:8815');
  const flights = await listFlights(client);

  const ticket = flights[0].endpoint![0].ticket!.ticket!;
  const stream = client.grpc.doGet({ ticket });
  const chunks: Uint8Array[] = [];

  for await (const data of stream) {
    if (data.dataBody) {
      chunks.push(data.dataBody);
    }
  }

  const reader = await RecordBatchReader.from(
    Buffer.concat(chunks)
  );

  for await (const batch of reader) {
    console.log('Batch rows:', batch.numRows);
  }

  await client.close();
}

main().catch(console.error);
