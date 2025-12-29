import { FlightClient, listFlights } from '../../src';

async function main() {
  const client = new FlightClient('localhost:8815', {
    metadata: {
      authorization: 'Bearer my-secret-token'
    }
  });

  const flights = await listFlights(client);
  
  console.log(flights);

  await client.close();
}

main().catch(console.error);
