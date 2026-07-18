import { FlightClient } from '../src';

async function main() {
  const client = new FlightClient('localhost:8815');

  try {
    for await (const flight of client.listFlights()) {
      const ticket = flight.endpoints[0]?.ticket;

      if (ticket) {
        const table = await client.getTable(ticket);
        console.log(table.toString());
        return;
      }
    }

    throw new Error('No Flight endpoint with a ticket was found');
  }
  finally {
    await client.close();
  }
}

main().catch(console.error);
