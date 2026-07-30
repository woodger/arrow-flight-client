# DuckDB Example

This example uses the repository's
[Docker Compose configuration](../../examples/duckdb/docker-compose.yml) to
start a Flight server on `localhost:8815`.

From the repository root, start the service:

```sh
docker compose -f examples/duckdb/docker-compose.yml up
```

In another process, send the server-specific SQL ticket and download the
result:

```ts
import { FlightClient } from 'arrow-flight-client';

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
```

Ticket contents are application-defined. Adjust the query and server setup for
the DuckDB Flight implementation you are using.

Stop and remove the service with:

```sh
docker compose -f examples/duckdb/docker-compose.yml down
```
