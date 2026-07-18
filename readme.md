# Apache Arrow Flight Client for Node.js

[![License](https://img.shields.io/npm/l/arrow-flight-client.svg)](https://github.com/woodger/arrow-flight-client/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/arrow-flight-client.svg)](https://www.npmjs.com/package/arrow-flight-client)

> Experimental: the public API may change before `1.0.0`.

A TypeScript client for the [Apache Arrow Flight protocol](https://arrow.apache.org/docs/format/Flight.html), built on `apache-arrow`, `nice-grpc`, and the official Flight protobuf contract.

The package provides:

- a `FlightClient` that owns a gRPC channel;
- optional TLS and request metadata;
- helpers for `ListFlights`, `GetFlightInfo`, `DoGet`, and `DoPut`;
- access to the generated low-level gRPC client through `flightClient.grpc`.

This is a client library only. It does not implement an Arrow Flight server.

## Requirements

- Node.js `>=16.9.0` for package consumers;
- an Arrow Flight server for integration scenarios.

Contributors need Node.js `>=20.19.0` because the development test runner requires it.

## Installation

```sh
npm install arrow-flight-client
```

## Quick Start

```ts
import { FlightClient, listFlights } from 'arrow-flight-client';

const client = new FlightClient('localhost:8815');

try {
  const flights = await listFlights(client);
  console.log(flights);
}
finally {
  await client.close();
}
```

### TLS And Metadata

Set `tls` to use the default TLS credentials and use `metadata` for headers that must be sent with each call:

```ts
const client = new FlightClient('flight.example.com:443', {
  tls: true,
  metadata: {
    authorization: 'Bearer my-token'
  }
});
```

Custom certificates and mutual TLS are not exposed through `FlightClientOptions` yet. See the [mTLS example](./examples/auth/mtls.ts) for low-level channel configuration.

## Public API

Consumers import the package root. Its public exports are defined by [`src/index.ts`](./src/index.ts):

- `FlightClient` — creates and owns the gRPC channel;
- `listFlights(client)` — collects the `ListFlights` response stream;
- `getFlightInfo(client, descriptor)` — requests metadata for a descriptor;
- `doGetTable(client, ticket)` — reads a Flight stream into an Arrow table;
- `doPutTable(client, table, path)` — uploads an Arrow table to a path descriptor.

`flightClient.grpc` is a low-level escape hatch to the generated `nice-grpc` client. Code that depends on generated protobuf types or methods beyond the exports above should be treated as unstable before `1.0.0`.

More usage scenarios are available in [`examples/`](./examples/readme.md).

## Current Limitations

- the API is not stable yet;
- `doGetTable` buffers the complete response before creating a table;
- there is no high-level `DoExchange` helper;
- custom TLS credentials require low-level `nice-grpc` setup;
- the project does not yet publish a verified server compatibility matrix.

## Development

Install development dependencies:

```sh
npm install
```

Run the repository checks:

```sh
npm run lint
npm run build
npm test
```

Tests run against compiled JavaScript, so run `npm run build` before `npm test` after changing TypeScript sources. `npm pack` and package publication invoke the build through `prepack`.

The Flight protocol source is [`contracts/Flight.proto`](./contracts/Flight.proto). [`src/generated/Flight.ts`](./src/generated/Flight.ts) is generated code and must not be edited manually.

Development and review rules are documented in the [project policies](./docs/policy/index.md).
Release history is maintained in the [changelog](./CHANGELOG.md).

## Project Status

The package is moving toward a production-ready `1.0.0`. Protocol correctness, interoperability tests, a stable typed public API, and streaming Arrow IPC handling are the main remaining milestones.

## License

[MIT](./LICENSE)

## Disclaimer

This project is an independent implementation and is not affiliated with the
Apache Software Foundation or its affiliates. Product and company names are
used solely to indicate compatibility with public APIs.

Information about third-party contracts and generated code is included in the
[LICENSE](LICENSE).
