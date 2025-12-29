import { FlightClient, listFlights } from '../src';

async function main() {
  const client = new FlightClient('localhost:8815');
  const flights = await listFlights(client);

  console.log('Available flights:');

  for (const flight of flights) {
    console.log('-', flight.flightDescriptor?.path);
  }

  await client.close();
}

main().catch(console.error);
