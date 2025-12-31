# Apache Arrow Flight Client for Node.js

[![License](https://img.shields.io/npm/l/express.svg)](https://github.com/woodger/pwd-fs/blob/master/LICENSE)

[![npm](https://nodei.co/npm/arrow-flight-client.png)](https://www.npmjs.com/package/arrow-flight-client)

> ⚠️ Experimental — API may change before v1.0.0

Apache Arrow Flight client implementation for [Node.js®](https://nodejs.org).
Native `gRPC-based` client built on top of `apache-arrow`, `nice-grpc`, and official Arrow Flight protobuf definitions.

To improve reliability and maintainability the code is based [TypeScript](https://www.typescriptlang.org). Streaming support (`DoGet`, `DoPut`). Compatible with:

  * PyArrow Flight Server
  * DuckDB Flight
  * Arrow `Java` / `C++` servers

## Getting Started

### Installation

To use `Flight Client` in your project, run:

```bash
npm install arrow-flight-client
```

> Requires **Node.js ≥ 18**


#### Table of Contents

[class FlightClient](#class-flightclient)

* [constructor: new FlightClient(address, options)](#constructor-new-flightclientaddress-options)

* [flightClient.close()](#flightclientclose)

* [flightClient.grpc](#flightclientgrpc)

* [listFlights(client)](#listflightsclient)

* [getFlightInfo(client, descriptor)](#getflightinfoclient-descriptor)

* [doGetTable(client, ticket)](#dogettableclient-ticket)

* [doPutTable(client, table, path)](#doputtableclient-table-path)



#### constructor: new FlightClient(address, options)

- `address` <[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)> The address of the Arrow Flight `gRPC` server (e.g. `localhost:8815`).
- `options` <[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)>
  - `tls` <[Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)> includes an implementation of the Transport Layer Security (TLS) and Secure Socket Layer (SSL) protocols, built on top of OpenSSL. **Default:** `false`.
  - `metadata` **Default:** `undefined`.

Create a client:

```ts
import { FlightClient } from 'arrow-flight-client';
s
const client = new FlightClient('localhost:8815');
```

Authentication & Metadata. You can pass metadata headers (e.g. auth tokens):

```ts
const client = new FlightClient('localhost:8815', {
  metadata: {
    authorization: 'Bearer my-token'
  }
});
```

#### flightClient.close()

- returns: <[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)> Following successful read, the `Promise` is resolved with an value with a `undefined`.

Premature connection close before the response is received.

#### flightClient.grpc

Returns the internal `gRPC` client (readonly).


#### listFlights(client)

- `client` <[FlightClient](#constructor-new-flightclientaddress-options)> `gRPC` client.
- returns: <[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)> Following successful read, the `Promise` is resolved with an value with a `Array`. List available flights.

Returns all available flights from the server:

```ts
import { listFlights } from 'arrow-flight-client';

const flights = await listFlights(client);
console.log(flights);
```

#### getFlightInfo(client, descriptor)

- `client` <[FlightClient](#constructor-new-flightclientaddress-options)> `gRPC` client.
- `descriptor` <[FlightDescriptor](#flightdescriptor)> describing the desired Flight.
- returns: <[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)> Fetches metadata for a specific flight.

```ts
import { getFlightInfo } from 'arrow-flight-client';

const descriptor = {
  type: FlightDescriptor_DescriptorType.PATH,
  path: ['example']
};
const info = await getFlightInfo(client, descriptor);
console.log(info);
```

#### doGetTable(client, ticket)

- `client` <[FlightClient](#constructor-new-flightclientaddress-options)> `gRPC` client.
- `ticket` <[Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)> containing the data set identifier.
- returns: <[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)> data stream FlightData.

Fetches Arrow Table via `DoGet` and returns an `apache-arrow`:

```ts
import { doGetTable } from 'arrow-flight-client';

const flight = flights[0];
const ticket = flight.endpoint[0].ticket.ticket;
const table = await doGetTable(client, ticket);
console.log(
  table.toString()
);
```

See `FlightData` stream:

```ts
for await (const batch of client.grpc.doGet(ticket)) {
  console.log(batch);
}
```


#### doPutTable(client, table, path)

Uploads an Arrow `Table` via `DoPut`.

```ts
import { doPutTable } from 'arrow-flight-client';
import { tableFromArrays } from 'apache-arrow';

const table = tableFromArrays({
  id: [1, 2, 3],
  name: ['Alice', 'Bob', 'Carol']
});

await doPutTable(client, table, ['example', 'table']);
```

---

## 🧠 Implementation Notes

* This client uses **gRPC streaming** under the hood
* Arrow data is transferred using **Arrow IPC**
* Built on:

  * `apache-arrow`
  * `nice-grpc`
  * `ts-proto`

#### Implementation details

- Built on top of **ts-proto** generated Flight protobuf definitions
- Uses **nice-grpc v2.x** (async generator–based API)
- Strict TypeScript types (no `any`, no unsafe casts)
- gRPC metadata is handled via client middleware

---

## 📚 Build

* Build TS services from proto files.
* See: https://github.com/stephenh/ts-proto
* Get proto files: https://github.com/apache/arrow

```sh
protoc \
  --plugin=protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto \
  --proto_path=./contracts \
  --ts_proto_out=./src/generated \
  --ts_proto_opt=outputServices=nice-grpc,outputServices=generic-definitions,useExactTypes=false \
  --ts_proto_opt="env=node" \
  --ts_proto_opt="esModuleInterop=true" \
  ./contracts/*.proto
```

---

## 🛣 Roadmap

* [ ] Proper Arrow IPC streaming (`RecordBatchReader`)
* [ ] `DoExchange`
* [*] Middleware support
* [ ] TLS configuration helpers

#### Limitations (current)

* `DoExchange` not yet implemented
* IPC parsing currently buffers the full stream (streaming batches planned)
* No server implementation (client only)

---

## 🚧 Project Status

This library is currently **experimental**.

- The Flight protocol implementation is functional
- The API is **not yet considered stable**
- Breaking changes may occur between minor releases

Once the API stabilizes, the project will follow **semantic versioning** starting from `v1.0.0`.

* [Apache Arrow](https://arrow.apache.org/)
* [nice-grpc](https://github.com/deeplay-io/nice-grpc)
* [ts-proto](https://github.com/stephenh/ts-proto)
