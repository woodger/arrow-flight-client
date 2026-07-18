import { FlightClient } from '../../src';

async function main() {
  const client = new FlightClient('localhost:8815', {
    metadata: {
      authorization: 'Bearer my-secret-token'
    }
  });

  try {
    for await (const flight of client.listFlights()) {
      console.log(flight);
    }
  }
  finally {
    await client.close();
  }
}

main().catch(console.error);
