# Testing Policy

> Type: Policy. This document limits the addition of tests and test infrastructure.

## Purpose

Tests must protect production contracts, observable behavior, and boundary scenarios.

A test must not lock in accidental implementation, temporary code structure, or internal action order unless this is part of the public contract.

The main question a test must answer is:

> Which behavior or production risk is protected?

Not:

> Which lines of code were executed?

## How To Run Tests

Tests are written in TypeScript in `src/**/*.test.ts` or `src/**/*.spec.ts` and use the standard Node.js modules:

- `node:test`;
- `node:assert`.

The test runner executes compiled JavaScript from `dist`. After changing TypeScript source, run:

```sh
npm run build
npm test
```

The command contract lives in [`package.json`](../../package.json). `fwa --prune` discovers compiled tests, rejects stale source/output pairs, removes stale compiled test artifacts, and delegates execution to `node:test`.

The published client supports the Node.js range declared in `package.json`. Repository development requires Node.js `>=20.19.0` because that is the minimum version supported by `fwa`.

## Test Requirements

Tests must be:

- isolated;
- deterministic;
- readable;
- minimal but sufficient;
- focused on one behavior;
- oriented toward observable result, not internal implementation.

One test must verify one behavior.

Multiple assertions in one test are allowed if they describe the same contract. If assertions verify different reasons for behavior changes, they must be split into separate tests.

## Test File Boundary

A unit test file must cover a specific production file, not a directory.

Mapping examples:

```text
src/client/flight-client.ts       -> src/client/flight-client.test.ts
src/client/actions.ts             -> src/client/actions.test.ts
src/client/do-get.ts              -> src/client/do-get.test.ts
src/client/do-put.ts              -> src/client/do-put.test.ts
src/client/metadata-middleware.ts -> src/client/metadata-middleware.test.ts
```

Creating a test whose name looks like a test for a directory or a barrel module is forbidden:

```text
src/client.test.ts
src/client/index.test.ts
src/index.test.ts                 # when src/index.ts only re-exports symbols
```

An exception is allowed when a file is a runtime or package entrypoint with behavior of its own. In that case, the test must verify entrypoint behavior, not the internal files of the directory.

Integration and end-to-end tests may cover several production files. Their scope must be visible in the filename or suite name, for example `flight-client.e2e.test.ts`, and their assertions must verify integration behavior rather than repeat unit tests.

## Imports In Tests

Unit tests must import code from the specific file they verify.

Allowed:

```ts
import { doGetTable } from './do-get';
import { metadataMiddleware } from './metadata-middleware';
```

Forbidden for a unit test of a specific file:

```ts
import { doGetTable, metadataMiddleware } from '../index';
```

An integration test may import through the public entrypoint if it verifies observable package behavior, exported API wiring, or interaction across client operations.

## Unit And Integration Boundaries

Unit tests must not require a live Flight server. gRPC streams and external responses should be represented by the smallest test double that preserves the behavior under test.

Tests against PyArrow, DuckDB, or another Flight implementation are integration tests. Their server requirement, credentials, ports, and lifecycle must be explicit and must not be hidden inside a unit test command.

Protocol-level tests should assert observable Arrow Flight behavior, including:

- request and response message framing;
- preservation of tickets, descriptors, and metadata;
- Arrow IPC schema and record batch reconstruction;
- stream completion and error propagation;
- channel ownership and close behavior.

## Isolation

A test must minimize dependence on:

- the real network, unless Flight interoperability is being tested;
- the real filesystem, unless packaging or generated output is being tested;
- current time;
- test execution order;
- external processes;
- global mutable state;
- stale build artifacts.

If dependence on an external resource is the essence of the test, it must be clearly visible from the test name, suite, or fixture.

## Test Data

Test data must be minimal but sufficient for the scenario.

Good:

```ts
test('returns all flights from the response stream', async () => {
  const flights = await listFlights(client);

  assert.deepEqual(flights, [firstFlight, secondFlight]);
});
```

Bad:

```ts
test('returns all flights from the response stream', async () => {
  const server = createFlightServerWithAuthenticationAndSeveralDatasets();
  const client = createClientWithRetriesAndCustomCertificates(server);
  const flights = await listFlights(client);

  assert.deepEqual(flights, [firstFlight, secondFlight]);
});
```

Extra infrastructure hides the reason for a focused collection test. It belongs in a separate integration scenario when that infrastructure is itself under test.

## Test Suite Naming

Test names must describe the public API path and expected behavior.

Top-level `describe()` names the unit under test:

- `FlightClient` for the class;
- `doGetTable` for a standalone exported function;
- `metadataMiddleware` for middleware behavior;
- `Flight client integration` for a scenario spanning several modules.

Good:

```ts
describe('FlightClient', () => {
  // ...
});

describe('doGetTable', () => {
  // ...
});
```

Bad:

```ts
describe('client utils', () => {
  // ...
});

describe('Arrow tests', () => {
  // ...
});
```

## Nested Suite Naming

Nested `describe()` names a public member or operation:

- `constructor` for constructor behavior;
- `#close` for `client.close()`;
- `#grpc` for the `client.grpc` accessor;
- the function name for standalone functions grouped under a module-level suite.

Example:

```ts
describe('FlightClient', () => {
  describe('constructor', () => {
    // ...
  });

  describe('#close', () => {
    // ...
  });
});
```

A parent suite must not contain sibling `describe()` blocks with the same name. If two blocks have the same name, they must be merged or named after different public scenarios.

## Test Case Naming

`test()` names only expected behavior.

The test name must not repeat the subject or method name if they are already stated in `describe()`.

Good:

```ts
describe('FlightClient', () => {
  describe('#close', () => {
    test('closes the owned channel', async () => {
      // ...
    });
  });
});
```

Bad:

```ts
describe('FlightClient', () => {
  describe('#close', () => {
    test('FlightClient close should close the channel', async () => {
      // ...
    });
  });
});
```

Repeating the subject makes the name noisy and worsens test output readability.

## Preferred Behavior Verbs

Preferred verbs for `test()` include:

- `returns ...`;
- `throws ...`;
- `rejects ...`;
- `reads ...`;
- `writes ...`;
- `keeps ...`;
- `skips ...`;
- `uses ...`;
- `does not ...`;
- `handles ...`;
- `preserves ...`;
- `collects ...`;
- `forwards ...`;
- `closes ...`.

Good:

```ts
test('preserves metadata arrays', async () => {
  // ...
});

test('rejects when the response stream fails', async () => {
  // ...
});
```

Bad:

```ts
test('works correctly', () => {
  // ...
});

test('should process data', () => {
  // ...
});
```

`should` is not technically forbidden, but the preferred style is a direct description of observable behavior without an extra modal word.

## Explicitness Over DRY

The drive toward DRY does not apply to tests.

Repetition in tests is allowed if it:

- keeps the scenario local;
- removes non-obvious setup;
- reduces the risk of mistakes in test infrastructure;
- allows the test case to be read without jumping to helpers.

A bad test is worse than no test: it creates false confidence and makes code harder to change.

## Generalization In Tests

Helpers in tests are usually undesirable.

A helper is allowed only if it removes technical noise and does not hide the meaning of the scenario. If a helper is more complex than the test itself, it must be removed. If a large helper, fixture builder, or conditional test setup is needed, this may signal that production code is poorly separated or that the test is at the wrong level.

A direct test with explicit Flight messages and Arrow data is preferable to abstract test infrastructure.

## Coverage Boundaries

There is no need to cover an entire public method or protocol contract with one large test.

If composite behavior sections are already checked separately, an additional large test is unnecessary. It is allowed to leave some sections without direct coverage if they are already protected by focused integration tests.
