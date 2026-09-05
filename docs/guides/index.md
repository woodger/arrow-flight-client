# Guides

English | [Русский](../ru/guides/index.md) | [简体中文](../zh/guides/index.md)

These consumer guides explain common `arrow-flight-client` scenarios with
copyable TypeScript snippets. They are documentation, not self-contained
runnable example projects. The snippets assume an Arrow Flight server
listening on `localhost:8815`.

Install the client and its required Arrow peer dependency:

```sh
npm install arrow-flight-client apache-arrow@^21.1.0
```

The package does not include a Flight server. Descriptors, tickets, actions,
and authentication are application-defined, so adapt those values to the
server you are using. See also the
[authentication guide](./authentication.md).

## List Flights

Stream the flights advertised by the server:

```ts
import { FlightClient } from 'arrow-flight-client';

async function main() {
  const client = new FlightClient('localhost:8815');

  try {
    console.log('Available flights:');

    for await (const flight of client.listFlights()) {
      console.log('-', flight.descriptor);
    }
  }
  finally {
    await client.close();
  }
}

main().catch(console.error);
```

## Download a Table

Find the first advertised endpoint with a ticket and collect its stream into
an Arrow table:

```ts
import { FlightClient } from 'arrow-flight-client';

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
```

## Stream Record Batches

Use `doGet()` when the response should be consumed incrementally instead of
collected into one table:

```ts
import { FlightClient } from 'arrow-flight-client';

async function main() {
  const client = new FlightClient('localhost:8815');

  try {
    for await (const flight of client.listFlights()) {
      const ticket = flight.endpoints[0]?.ticket;

      if (!ticket) {
        continue;
      }

      const reader = await client.doGet(ticket);

      for await (const chunk of reader) {
        if (chunk.data) {
          console.log('Batch rows:', chunk.data.numRows);
        }
      }

      return;
    }

    throw new Error('No Flight endpoint with a ticket was found');
  }
  finally {
    await client.close();
  }
}

main().catch(console.error);
```

## Upload a Table

Upload an Arrow table and consume application metadata returned by the server:

```ts
import { FlightClient, pathDescriptor } from 'arrow-flight-client';
import { tableFromArrays } from 'apache-arrow';

async function main() {
  const client = new FlightClient('localhost:8815');

  const table = tableFromArrays({
    id: [4, 5, 6],
    name: ['Dave', 'Eve', 'Frank']
  });

  try {
    for await (const result of client.doPut(
      pathDescriptor('uploaded', 'table'),
      table
    )) {
      console.log('Server metadata:', result.appMetadata);
    }

    console.log('Table uploaded');
  }
  finally {
    await client.close();
  }
}

main().catch(console.error);
```

`Handshake` and `DoExchange` remain available through `FlightClient.raw`, with
their curated messages and codecs under the root `flightProtocol` namespace.
The caller owns raw `DoExchange` Arrow IPC framing.

## Read Error Details

Use `FlightCallOptions.onTrailer` to retain trailing metadata for a call,
including when it fails. PyArrow's gRPC transport sends `FlightError.extra_info`
as opaque bytes in `grpc-status-details-bin`, as shown in the
[Arrow transport implementation](https://github.com/apache/arrow/blob/apache-arrow-24.0.0/cpp/src/arrow/flight/transport/grpc/util_internal.cc#L297).
The callback receives arrays of text or binary values and must not throw.
Store the trailers there and interpret the payload when handling the error:

```ts
import { FlightClient, pathDescriptor } from 'arrow-flight-client';
import type { FlightResponseMetadata } from 'arrow-flight-client';

async function main() {
  const client = new FlightClient('localhost:8815');
  let trailer: FlightResponseMetadata | undefined;

  try {
    await client.getFlightInfo(pathDescriptor('model'), {
      onTrailer: (metadata) => { trailer = metadata; }
    });
  }
  catch (error) {
    const extraInfo = trailer?.['grpc-status-details-bin']?.[0];

    if (extraInfo instanceof Uint8Array) {
      console.error('Flight extra_info:', Buffer.from(extraInfo).toString('utf8'));
    }

    throw error;
  }
  finally {
    await client.close();
  }
}

main().catch(console.error);
```

This example assumes the server uses UTF-8 text. If the payload is JSON,
parse and validate it according to the server's application contract. The
client preserves the bytes and the existing error's `code` and `details`.
The same option is available for streaming calls and `getTable()` / `putTable()`;
trailers arrive when the RPC finishes, not when a reader is first opened.
Failures before a server response may have no server-provided trailers.
