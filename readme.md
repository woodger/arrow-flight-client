# Apache Arrow Flight Client for Node.js

[![License](https://img.shields.io/npm/l/arrow-flight-client.svg)](https://github.com/woodger/arrow-flight-client/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/arrow-flight-client.svg)](https://www.npmjs.com/package/arrow-flight-client)

> Experimental: the public API may change before `1.0.0`.

A TypeScript client for the [Apache Arrow Flight protocol](https://arrow.apache.org/docs/format/Flight.html), built on `apache-arrow`, `nice-grpc`, and the official Flight protobuf contract.

The package provides a streaming Node.js API for Flight discovery, schemas,
`DoGet`, `DoPut`, and actions. Arrow IPC framing and generated protobuf values
remain internal to the high-level API.

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
import { FlightClient, pathDescriptor } from 'arrow-flight-client';

const client = new FlightClient('localhost:8815');

try {
  for await (const flight of client.listFlights()) {
    console.log(flight.descriptor, flight.endpoints);
  }

  const info = await client.getFlightInfo(
    pathDescriptor('database', 'table')
  );
  const ticket = info.endpoints[0]?.ticket;

  if (!ticket) {
    throw new Error('The Flight endpoint has no ticket');
  }

  const table = await client.getTable(ticket);
  console.log(table.toString());
}
finally {
  await client.close();
}
```

## Streaming DoGet

`doGet()` does not collect the complete response. It returns a reader whose
chunks preserve the relationship between Arrow record batches and Flight
application metadata:

```ts
const reader = await client.doGet(ticket);

for await (const chunk of reader) {
  if (chunk.data) {
    console.log('Rows:', chunk.data.numRows);
  }

  if (chunk.appMetadata) {
    console.log('Metadata:', chunk.appMetadata);
  }
}
```

Use `getTable()` when collecting the complete stream into an Arrow `Table` is
intentional.

## DoPut

```ts
import { tableFromArrays } from 'apache-arrow';
import { FlightClient, pathDescriptor } from 'arrow-flight-client';

const table = tableFromArrays({ id: [1, 2], name: ['one', 'two'] });

for await (const result of client.doPut(
  pathDescriptor('uploaded', 'table'),
  table
)) {
  console.log('Server metadata:', result.appMetadata);
}
```

`doPut()` also accepts synchronous and asynchronous `RecordBatch` iterables.
Pass `FlightPutOptions.schema` when an iterable may be empty. `putTable()` is a
convenience method that collects all `PutResult` messages.

## TLS, Metadata, And Cancellation

```ts
const client = new FlightClient('flight.example.com:443', {
  tls: {
    rootCertificates,
    privateKey,
    certificateChain
  },
  metadata: {
    authorization: 'Bearer my-token'
  }
});

const controller = new AbortController();

const info = await client.getFlightInfo(descriptor, {
  signal: controller.signal,
  deadline: new Date(Date.now() + 5_000),
  metadata: {
    'x-request-id': 'request-1'
  }
});
```

Per-call metadata replaces configured values with the same key. A TLS private
key and certificate chain must be provided together for mutual TLS.

## Public API

The package root is the stable high-level entrypoint. It includes:

- `FlightClient` and call/client option types;
- `pathDescriptor()` and `commandDescriptor()`;
- streaming `listFlights()`, `doGet()`, `doPut()`, `doAction()`, and
  `listActions()` methods;
- unary `getFlightInfo()`, `pollFlightInfo()`, and `getSchema()` methods;
- buffered `getTable()` and `putTable()` conveniences.

The earlier standalone `listFlights`, `getFlightInfo`, `doGetTable`, and
`doPutTable` functions remain available as compatibility helpers.

Generated protobuf messages and the low-level service definition are available
from `arrow-flight-client/raw`. The same generated client is exposed as
`flightClient.raw`; the former `flightClient.grpc` name remains as a deprecated
alias.

The API boundaries and intentional limitations are described in the
[public API design](./docs/public-api.md). More scenarios are available in the
[examples](./examples/readme.md).

## Current Limitations

- `Handshake` and `DoExchange` currently require the raw API;
- endpoint location routing is not automatic; `DoGet` uses the current client;
- transport failures are currently exposed as `nice-grpc` errors;
- the project does not yet publish a verified server compatibility matrix.

## Development

Install dependencies and run the repository checks:

```sh
npm install
npm run lint
npm run build
npm test
```

Tests run against compiled JavaScript, so run `npm run build` before `npm test`
after changing TypeScript sources. Package publication invokes the build through
`prepack`.

The Flight protocol source is [`contracts/Flight.proto`](./contracts/Flight.proto).
[`src/generated/Flight.ts`](./src/generated/Flight.ts) is generated code and
must not be edited manually. Development and review rules are documented in the
[project policies](./docs/policy/index.md), and release history is maintained in
the [changelog](./CHANGELOG.md).

## License

[MIT](./LICENSE)

## Дисклеймер

Проект является независимой реализацией и не имеет никакого отношения к
Apache или их аффилированным лицам. Названия продуктов и компаний
используются только для обозначения совместимости с публичным API.

Сведения о сторонних контрактах и generated-коде включены в [LICENSE](LICENSE).
