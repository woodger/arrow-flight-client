# Public API Design

> Type: Design. This document records the boundary and stability decisions for
> the Node.js Arrow Flight client.

The source of truth for package exports is [`src/index.ts`](../src/index.ts).
Observable stream behavior is protected by tests colocated with
[`src/client/`](../src/client/), while the wire contract remains
[`contracts/Flight.proto`](../contracts/Flight.proto).

## API Boundary

The package root exposes project-owned descriptors, metadata values, response
objects, and Arrow JS objects. Generated protobuf requirements such as enum
members, empty `Buffer` fields, `dataHeader`, and `dataBody` are not part of the
high-level calling convention.

Low-level protobuf and gRPC access is intentionally separated through the
`arrow-flight-client/raw` package subpath and `FlightClient.raw`. This escape
hatch is intended for Flight operations or application extensions that do not
yet have a high-level wrapper.

## Streaming Model

Flight response streams remain `AsyncIterable` values. `listFlights()`,
`doPut()`, `doAction()`, and `listActions()` do not collect responses. `doGet()`
returns a single-use `FlightStreamReader` so a record batch and its
application metadata remain associated and metadata-only messages are not
discarded.

Collection is explicit: `getTable()` creates a complete Arrow `Table`, and
`putTable()` collects all server `PutResult` messages.

## IPC Ownership

The client owns the conversion between Flight framing and Arrow IPC:

- every `FlightData.dataHeader` contains one raw Arrow IPC `Message` flatbuffer;
- `FlightData.dataBody` contains only the corresponding Arrow body buffers;
- a `DoPut` descriptor is attached only to the first message;
- a `DoGet` stream reconstructs encapsulated IPC framing before Arrow JS reads
  the schema, dictionary messages, and record batches;
- body lengths are validated before data reaches the Arrow reader.

Callers should not construct these fields when using the package root.

## Lifecycle And Calls

`FlightClient` owns one gRPC channel. `close()` is idempotent, and new
high-level calls are rejected after closure. Client metadata applies to every
call; per-call metadata replaces matching configured keys. Calls support an
`AbortSignal` and an absolute `Date` deadline.

TLS uses platform roots by default and accepts custom roots plus an optional
mutual-TLS identity. A private key and certificate chain form one identity and
must be configured together.

## Version 0.0.7 Scope

The high-level API covers discovery, `GetFlightInfo`, `PollFlightInfo`,
`GetSchema`, `DoGet`, `DoPut`, and actions. Handshake flows, `DoExchange`,
automatic endpoint location routing, and normalized transport errors remain
outside the high-level contract and are available only through the raw API
where the protocol supports them.
