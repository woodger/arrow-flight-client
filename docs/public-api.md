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

`apache-arrow@^21.1.0` is a required peer dependency. The application and
client must resolve one runtime instance because Arrow tables, record batches,
schemas, and IPC writers rely on runtime class identity. Values from a second
physical copy or unsupported major version are not a compatible public input.

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
- client application metadata is sent as a metadata-only message immediately
  after the `DoPut` schema so server readers can observe it even without data;
- a `DoGet` stream reconstructs encapsulated IPC framing before Arrow JS reads
  the schema, dictionary messages, and record batches;
- body lengths are validated before data reaches the Arrow reader.

Callers should not construct these fields when using the package root. The IPC
adapter preserves caller-provided batch boundaries and does not split an
oversized `RecordBatch` automatically.

## Lifecycle And Calls

`FlightClient` owns one gRPC channel. `close()` is idempotent, and new
high-level calls are rejected after closure. Client metadata applies to every
call; per-call metadata replaces matching configured keys. Calls support an
`AbortSignal` and an absolute `Date` deadline. Caller cancellation rejects with
`AbortError`; deadline expiry rejects with a nice-grpc `ClientError` whose code
is `DEADLINE_EXCEEDED`.

TLS uses platform roots by default and accepts custom roots plus an optional
mutual-TLS identity. A private key and certificate chain form one identity and
must be configured together.

`maxReceiveMessageLength` and `maxSendMessageLength` configure the corresponding
gRPC message limits in bytes. A limit applies to each serialized `FlightData`
message, not to the complete stream, so large logical payloads should use
multiple bounded record batches with transport-envelope headroom.

## Current Scope

The high-level API covers discovery, `GetFlightInfo`, `PollFlightInfo`,
`GetSchema`, `DoGet`, `DoPut`, and actions. Handshake flows and `DoExchange`
require the raw API, and automatic endpoint location routing is not implemented.
Transport failures remain nice-grpc errors; deadline expiry is explicitly
reported with the `DEADLINE_EXCEEDED` status.
