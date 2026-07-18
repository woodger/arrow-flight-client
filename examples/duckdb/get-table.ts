import { FlightClient } from '../../src';

async function main() {
  const client = new FlightClient('localhost:8815');

  const ticket = new TextEncoder().encode('SELECT * FROM my_table');

  try {
    const table = await client.getTable(ticket);
    console.log(table.toString());
  }
  finally {
    await client.close();
  }
}

main().catch(console.error);
