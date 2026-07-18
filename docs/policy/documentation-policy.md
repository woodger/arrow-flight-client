# Documentation Policy

> Type: Policy. This document defines rules for choosing the documentation source of truth and forbids duplicating code contracts in permanent reference pages.

## Purpose

Documentation must help find the current contract, not create a second source of truth next to the code.

If a contract is already expressed by a runtime mechanism, source file, config file, or tests, a Markdown document must link to that source and explain the working route instead of copying the full reference.

## README And Docs

README must remain a concise entry point to the project:

- installation;
- quick start;
- main links;
- important workflows.

Detailed rules and policies must live in `docs/`.

Navigation documents must help find the source of truth, not become a second README.

## Project Sources Of Truth

- package metadata, supported Node.js version, dependencies, entrypoints, and scripts: [`package.json`](../../package.json);
- public package surfaces:
  [`src/index.ts`](https://github.com/woodger/arrow-flight-client/blob/v0.0.9/src/index.ts)
  and
  [`src/raw.ts`](https://github.com/woodger/arrow-flight-client/blob/v0.0.9/src/raw.ts);
- client behavior:
  [`src/client/`](https://github.com/woodger/arrow-flight-client/tree/v0.0.9/src/client);
- Flight wire contract: [`contracts/Flight.proto`](../../contracts/Flight.proto);
- generated TypeScript bindings:
  [`src/generated/Flight.ts`](https://github.com/woodger/arrow-flight-client/blob/v0.0.9/src/generated/Flight.ts);
- compiler settings:
  [`tsconfig.json`](https://github.com/woodger/arrow-flight-client/blob/v0.0.9/tsconfig.json);
- lint configuration:
  [`eslint.config.mjs`](https://github.com/woodger/arrow-flight-client/blob/v0.0.9/eslint.config.mjs);
- observable behavior: tests colocated with source files under `src/`.

`src/generated/Flight.ts` reflects the protobuf generator output. It is a derived artifact, not a place for manual contract edits. Protocol changes start in `contracts/Flight.proto` and must use the repository's approved generation workflow.

Examples demonstrate intended usage but do not override the public exports, types, or tested behavior.

## Changelog

[`CHANGELOG.md`](../../CHANGELOG.md) follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Every notable change must be added to `Unreleased` under the appropriate heading:

- `Added` for new capabilities;
- `Changed` for changes to existing behavior or contracts;
- `Deprecated` for capabilities scheduled for removal;
- `Removed` for removed capabilities;
- `Fixed` for defect corrections;
- `Security` for vulnerability fixes.

The changelog is written for package users. It must describe observable changes and must not become a raw commit log.

When a version is published, move its entries from `Unreleased` into a version section using the `YYYY-MM-DD` release date. Keep an empty `Unreleased` section at the top and update the comparison links at the bottom of the file.

## Minimum Rule

Markdown must answer the question "where is the current contract and how should it be used". The contract itself must live where it is verified by runtime or tests.
