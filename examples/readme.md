# Examples — Apache Arrow Flight Client for Node.js

These examples demonstrate the high-level API against an Arrow Flight server
listening on `localhost:8815`.

## Prerequisites

- Node.js `>=20.19.0` for the repository toolchain;
- an Arrow Flight server with operations matching the selected example;
- installed project dependencies.

The repository does not bundle a server. PyArrow, DuckDB extensions, and other
Flight implementations may use different descriptors, tickets, actions, and
authentication settings, so adapt those application-defined values to the
server under test.

Run an example with a TypeScript runner of your choice or compile it as part of
a local scenario. The repository build itself compiles only `src/`.

## Scenarios

- [`list-flights.ts`](./list-flights.ts) streams discovery results;
- [`get-table.ts`](./get-table.ts) collects the first available endpoint into a
  table;
- [`streaming-batches.ts`](./streaming-batches.ts) consumes record batches
  incrementally;
- [`put-table.ts`](./put-table.ts) uploads a table and reads server metadata;
- [`auth/`](./auth/readme.md) configures bearer metadata or mutual TLS;
- [`duckdb/get-table.ts`](./duckdb/get-table.ts) shows a server-specific ticket.

`Handshake` and `DoExchange` do not yet have high-level examples. They remain
available through `FlightClient.raw`, with their curated messages and codecs
under the root `flightProtocol` namespace. The caller owns raw `DoExchange` IPC
framing.
