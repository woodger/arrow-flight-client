import { FlightClient } from '../src';

async function main() {
  const client = new FlightClient('localhost:8815');

  try {
    console.log('Available flights:');

    for await (const flight of client.listFlights()) {
      console.log('-', flight.descriptor);
    }
  }
  finally {
    await client.close();
  }
}

main().catch(console.error);
