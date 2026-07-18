# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added ESLint with TypeScript support and a project lint command.
- Added `fwa` for compiled TypeScript test discovery and stale-test pruning.
- Added a `prepack` build step for package publication.
- Added project development and review policies under `docs/policy/`.
- Added repository metadata to the package manifest.
- Added third-party contract and generated-code notices to the license.

### Changed

- Lowered the package runtime requirement from Node.js `>=18.0.0` to
  `>=16.9.0` while requiring Node.js `>=20.19.0` for repository development.
- Upgraded the TypeScript development toolchain to TypeScript 6 and ESLint 9.
- Reworked the README around the current public API, development workflow,
  limitations, licensing, and project disclaimer.
- Updated npm publication contents to include development policies while
  excluding source files, tests, and local tooling.

### Removed

- Removed the direct `ts-proto` development dependency.
- Removed stale lowercase duplicates of generated Flight build artifacts.

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

[Unreleased]: https://github.com/woodger/arrow-flight-client/compare/70c990a8066f504a590204416e4cc580c1ca6c15...HEAD
[0.0.6]: https://github.com/woodger/arrow-flight-client/compare/8e5e3c2747716b92adaa4a49d0d789923b9557c7...70c990a8066f504a590204416e4cc580c1ca6c15
[0.0.5]: https://github.com/woodger/arrow-flight-client/tree/8e5e3c2747716b92adaa4a49d0d789923b9557c7
