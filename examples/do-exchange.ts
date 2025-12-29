import { FlightClient } from '../src';
import { FlightDescriptor } from '../src/generated/Flight';

async function main() {
  const client = new FlightClient('localhost:8815');
  const descriptor: FlightDescriptor = {
    type: 'PATH',
    path: ['exchange']
  };

  const stream = client.grpc.doExchange();

  // Send request
  await stream.write({
    flightDescriptor: descriptor
  });

  // Read responses
  for await (const response of stream) {
    console.log('Received:', response);
  }

  await stream.end();
  await client.close();
}

main().catch(console.error);
