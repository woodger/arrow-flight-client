import { FlightClient, doGetTable } from '../../src';

async function main() {
  const client = new FlightClient('localhost:8815');

  // DuckDB обычно использует path как descriptor
  const ticket = new TextEncoder().encode('SELECT * FROM my_table');
  const table = await doGetTable(client, ticket);

  console.log(table.toString());

  await client.close();
}

main().catch(console.error);