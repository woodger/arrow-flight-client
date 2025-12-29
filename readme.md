# Apache Arrow Flight Client for Node.js

> 🚀 **Apache Arrow Flight client implementation for Node.js (TypeScript)**
> Native gRPC-based client built on top of `apache-arrow`, `nice-grpc`, and official Arrow Flight protobuf definitions.

---

## ✨ Features

* ✅ Apache Arrow **Flight protocol**
* ✅ **TypeScript-first**, fully typed API
* ✅ Built on **official Arrow Flight `.proto`**
* ✅ Streaming support (`DoGet`, `DoPut`)
* ✅ Compatible with:

  * PyArrow Flight Server
  * DuckDB Flight
  * Arrow Java / C++ servers
* ✅ Zero native dependencies (pure Node.js)

---

## 📦 Installation

```bash
npm install arrow-flight-client
```

> Requires **Node.js ≥ 18**

---

## 🚀 Quick Start

### Create a client

```ts
import { FlightClient } from '@your-scope/arrow-flight-client'

const client = new FlightClient('localhost:8815')
```

---

### List available flights

```ts
import { listFlights } from '@your-scope/arrow-flight-client'

const flights = await listFlights(client)

console.log(flights)
```

---

### Fetch Arrow Table (DoGet)

```ts
import { doGetTable } from '@your-scope/arrow-flight-client'

const flight = flights[0]
const ticket = flight.endpoint[0].ticket.ticket

const table = await doGetTable(client, ticket)

console.log(table.toString())
```

---

### Upload Arrow Table (DoPut)

```ts
import { doPutTable } from '@your-scope/arrow-flight-client'
import { tableFromArrays } from 'apache-arrow'

const table = tableFromArrays({
  id: [1, 2, 3],
  name: ['Alice', 'Bob', 'Carol']
})

await doPutTable(client, table, ['example', 'table'])
```

---

## 📚 API

### `FlightClient`

```ts
new FlightClient(address: string, options?: FlightClientOptions)
```

#### Options

```ts
interface FlightClientOptions {
  tls?: boolean
  metadata?: Record<string, string>
}
```

---

### `listFlights(client)`

Returns all available flights from the server.

---

### `getFlightInfo(client, descriptor)`

Fetches metadata for a specific flight.

---

### `doGetTable(client, ticket)`

Fetches Arrow data via `DoGet` and returns an `apache-arrow` `Table`.

---

### `doPutTable(client, table, path)`

Uploads an Arrow `Table` via `DoPut`.

---

## 🔐 Authentication & Metadata

You can pass metadata headers (e.g. auth tokens):

```ts
const client = new FlightClient('localhost:8815', {
  metadata: {
    authorization: 'Bearer my-token'
  }
})
```

---

## 🧠 Implementation Notes

* This client uses **gRPC streaming** under the hood
* Arrow data is transferred using **Arrow IPC**
* Built on:

  * `apache-arrow`
  * `nice-grpc`
  * `ts-proto`

---

## ⚠️ Limitations (current)

* `DoExchange` not yet implemented
* IPC parsing currently buffers the full stream (streaming batches planned)
* No server implementation (client only)

---

## 🛣 Roadmap

* [ ] Proper Arrow IPC streaming (`RecordBatchReader`)
* [ ] `DoExchange`
* [ ] Middleware support
* [ ] TLS configuration helpers
* [ ] Benchmarks vs Python Flight client

---

## 🧪 Tested Against

* PyArrow Flight Server
* DuckDB Flight Server

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo
2. Create a feature branch
3. Add tests if possible
4. Open a PR

---

## 📜 License

Apache License 2.0
Compatible with Apache Arrow project.

---

## 🙌 Acknowledgements

* [Apache Arrow](https://arrow.apache.org/)
* [nice-grpc](https://github.com/deeplay-io/nice-grpc)
* [ts-proto](https://github.com/stephenh/ts-proto)
