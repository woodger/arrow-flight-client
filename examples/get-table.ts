import { FlightClient, listFlights, doGetTable } from '../src';

async function main() {
  const client = new FlightClient('localhost:8815');
  const flights = await listFlights(client);
  
  const flight = flights[0];
  const ticket = flight.endpoint?.[0].ticket?.ticket;

  if (!ticket) {
    throw new Error('No ticket found');
  }

  const table = await doGetTable(client, ticket);

  console.log(table.toString());

  await client.close();
}

main().catch(console.error);
