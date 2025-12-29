import { FlightClient } from '../src';
import { FlightDescriptor_DescriptorType } from '../src/generated/Flight';

async function main() {
  const client = new FlightClient('localhost:8815');
  const stream = client.grpc.doExchange();

  await stream.write({
    flightDescriptor: {
      type: FlightDescriptor_DescriptorType.PATH,
      path: ['exchange']
    }
  });

  for await (const response of stream) {
    console.log('Received:', response);
  }

  await stream.end();
  await client.close();
}

main().catch(console.error);
