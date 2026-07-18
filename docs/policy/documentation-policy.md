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
- public package exports: [`src/index.ts`](../../src/index.ts);
- client behavior: [`src/client/`](../../src/client/);
- Flight wire contract: [`contracts/Flight.proto`](../../contracts/Flight.proto);
- generated TypeScript bindings: [`src/generated/Flight.ts`](../../src/generated/Flight.ts);
- compiler settings: [`tsconfig.json`](../../tsconfig.json);
- lint configuration: [`eslint.config.mjs`](../../eslint.config.mjs);
- observable behavior: tests colocated with source files under `src/`.

`src/generated/Flight.ts` reflects the protobuf generator output. It is a derived artifact, not a place for manual contract edits. Protocol changes start in `contracts/Flight.proto` and must use the repository's approved generation workflow.

Examples demonstrate intended usage but do not override the public exports, types, or tested behavior.

## Minimum Rule

Markdown must answer the question "where is the current contract and how should it be used". The contract itself must live where it is verified by runtime or tests.
