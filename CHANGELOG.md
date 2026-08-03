# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added Russian translations for the README, public API design, and consumer
  guides, with cross-language navigation and English as the authoritative
  source.

## [0.0.11] - 2026-07-30

### Added

- Added standard npm metadata for the documentation directory, CommonJS module
  type, issue tracker, and project homepage.
- Added a committed Yarn Classic lockfile for reproducible development
  installs while keeping it out of the published package.

### Fixed

- Streamed `Table` uploads one record batch at a time and delivered metadata-only
  response messages without buffering them until the next Arrow batch.
- Kept long-range deadlines within Node.js timer limits and released prepared
  call resources when the client closes.
- Allowed an empty per-call metadata array to remove a configured metadata key.

### Changed

- Restored the project-local protobuf generation command with a pinned
  toolchain and regenerated bindings from the current Flight contract.
- Replaced ESLint with a pinned Biome linter while preserving the project lint
  command and excluding generated bindings.
- Upgraded the development compiler to TypeScript 7.0.2 and Fwa to 2.1.0,
  removing the test runner's dependency on the compiler API.
- Simplified the package export map to expose only the root entrypoint.
- Moved verified consumer guides to `docs/guides/` as published documentation,
  removed the unverified DuckDB Flight setup, and kept contributor policies
  under `docs/policy/` out of the npm package.

## [0.0.10] - 2026-07-19

### Added

- Added a curated `flightProtocol` namespace at the package root for selected
  Flight protobuf messages, codecs, enums, the service definition, and the
  explicit low-level client types and transport metadata constructor.

### Changed

- Replaced the generator-derived `FlightGrpcClient` alias and
  `FlightServiceClient` type with the explicit ten-method
  `flightProtocol.FlightRawClient` contract, and added curated names for nested
  protocol types.

### Removed

- Removed the `arrow-flight-client/raw` package subpath. Import low-level
  protocol contracts from the root `flightProtocol` namespace instead.

## [0.0.9] - 2026-07-18

### Changed

- Expired call deadlines now reject with a nice-grpc `ClientError` using the
  `DEADLINE_EXCEEDED` status, while caller cancellation remains an `AbortError`.
- Declared `apache-arrow@^21.1.0` as a required peer dependency so applications
  and the client use one supported Arrow runtime instance.

### Removed

- Removed the GitHub Actions CI workflow; repository checks and the live
  PyArrow compatibility suite remain explicit local development responsibilities.

### Fixed

- Included referenced documentation in the npm package and linked excluded
  source and configuration files to the versioned GitHub tree.

## [0.0.8] - 2026-07-18

### Added

- Added explicit per-message gRPC receive and send size settings through
  `FlightClientOptions`.
- Added a Node-to-PyArrow 24 compatibility suite and CI gate for configured
  metadata, large downloads, bounded uploads, and `DoPut` application metadata.

### Changed

- Synchronized the vendored Flight protocol contract byte-for-byte with Apache
  Arrow 24.0.0.

### Removed

- Removed the unused vendored `field_behavior.proto` contract and both copies
  of `descriptor.proto`.

### Fixed

- Connected configured client metadata through the nice-grpc client factory so
  it is sent on every RPC and remains overridable per call.
- Sent `FlightPutOptions.appMetadata` in a standalone Flight metadata message
  after the schema so PyArrow exposes it, including for empty uploads.

## [0.0.7] - 2026-07-18

### Added

- Added a streaming high-level `FlightClient` API for discovery, schemas,
  polling, `DoGet`, `DoPut`, and actions.
- Added project-owned descriptors, Flight response types, and descriptor
  builders that do not require generated protobuf values.
- Added `FlightStreamReader` to preserve record batch and application metadata
  ordering without buffering the complete response.
- Added per-call metadata, cancellation, deadlines, custom TLS roots, and mTLS
  client identity support.
- Added the `arrow-flight-client/raw` package entrypoint for generated protobuf
  messages and the low-level service definition.
- Added explicit runtime dependencies for protobuf wire support and direct
  gRPC imports.
- Added ESLint with TypeScript support and a project lint command.
- Added `fwa` for compiled TypeScript test discovery and stale-test pruning.
- Added a `prepack` build step for package publication.
- Added project development and review policies under `docs/policy/`.
- Added repository metadata to the package manifest.
- Added third-party contract and generated-code notices to the license.

### Changed

- Made Flight response streams `AsyncIterable` by default and kept collection
  explicit through `getTable()` and `putTable()`.
- Exposed the generated client as `FlightClient.raw`.
- Lowered the package runtime requirement from Node.js `>=18.0.0` to
  `>=16.9.0` while requiring Node.js `>=20.19.0` for repository development.
- Enabled strict TypeScript checks, Node.js module resolution, and direct
  `src/` to `dist/` compilation.
- Replaced the untyped low-level gRPC client surface with the generated
  `nice-grpc` client type.
- Updated `nice-grpc` to 2.1.16.
- Upgraded the TypeScript development toolchain to TypeScript 6 and ESLint 9.
- Reworked the README around the current public API, development workflow,
  limitations, licensing, and project disclaimer.
- Updated npm publication contents to include development policies while
  excluding source files, tests, and local tooling.

### Deprecated

- Deprecated `FlightClient.grpc` in favor of the explicit `FlightClient.raw`
  low-level escape hatch.

### Removed

- Removed the non-functional high-level `DoExchange` example; `DoExchange`
  remains available through the raw client until its streaming contract is
  implemented.
- Removed the direct `ts-proto` development dependency.
- Removed stale lowercase duplicates of generated Flight build artifacts.
- Removed tracked build output from the legacy `dist/src` and `dist/examples`
  layout.

### Fixed

- Split outgoing Arrow IPC metadata and body buffers into protocol-correct
  `FlightData` messages and attached the `DoPut` descriptor only to the first
  message.
- Reconstructed encapsulated Arrow IPC framing for `DoGet`, including schema,
  dictionary, record batch, and application metadata handling.
- Preserved server `PutResult.app_metadata` instead of discarding responses.
- Updated `DoPut` to use the async-iterable bidirectional streaming contract
  provided by `nice-grpc`.
- Made `FlightClient.close()` idempotent and rejected new high-level calls
  after closure.

## [0.0.6] - 2026-01-02

### Changed

- Expanded the public API documentation and usage examples.
- Improved `FlightClient` contract documentation.

## [0.0.5] - 2025-12-29

### Added

- Published the initial Arrow Flight client for Node.js.
- Added gRPC client creation with TLS and request metadata support.
- Added helpers for `ListFlights`, `GetFlightInfo`, `DoGet`, and `DoPut`.
- Added Arrow table upload and download examples.
- Added initial unit and mock integration tests.

[Unreleased]: https://github.com/woodger/arrow-flight-client/compare/v0.0.11...HEAD
[0.0.11]: https://github.com/woodger/arrow-flight-client/compare/f14c512751f452f21903c7896e024282df9b6ab7...v0.0.11
[0.0.10]: https://github.com/woodger/arrow-flight-client/compare/v0.0.9...f14c512751f452f21903c7896e024282df9b6ab7
[0.0.9]: https://github.com/woodger/arrow-flight-client/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/woodger/arrow-flight-client/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/woodger/arrow-flight-client/compare/70c990a8066f504a590204416e4cc580c1ca6c15...v0.0.7
[0.0.6]: https://github.com/woodger/arrow-flight-client/compare/8e5e3c2747716b92adaa4a49d0d789923b9557c7...70c990a8066f504a590204416e4cc580c1ca6c15
[0.0.5]: https://github.com/woodger/arrow-flight-client/tree/8e5e3c2747716b92adaa4a49d0d789923b9557c7
