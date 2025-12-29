import { FlightClient, doPutTable } from '../src';
import { tableFromArrays } from 'apache-arrow';

async function main() {
  const client = new FlightClient('localhost:8815');

  const table = tableFromArrays({
    id: [4, 5, 6],
    name: ['Dave', 'Eve', 'Frank']
  })

  await doPutTable(client, table, ['uploaded', 'table']);

  console.log('Table uploaded');

  await client.close();
}

main().catch(console.error);
