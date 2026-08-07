# Dependencies Policy

> Type: Policy. This document defines criteria for choosing new libraries and signs of undesirable dependencies.

Only high-quality libraries are allowed.

## Package Manager

npm is the only supported package manager for development and CI.

- use `npm ci` for reproducible installs from the committed `package-lock.json`;
- use `npm install` only when intentionally changing dependencies, and commit
  the resulting `package.json` and `package-lock.json` changes together;
- do not use Yarn, pnpm, Bun, or lockfiles produced by alternative package
  managers;
- do not add `packageManager` or `devEngines` to `package.json` to enforce this
  policy.

A library must:

- solve a broad problem
- have a clear API
- be maintained
- provide architectural value
- be justified long term

Undesirable dependencies:

- a package for one function
- a package for deleting files
- a package for a small utility
- a package wrapper over a standard function

Bad example:

a package used only to concatenate two `Uint8Array` values

Good example:

a maintained Arrow IPC or gRPC library that owns a complete protocol boundary

## Selection Examples

Allowed:

- add a library that covers a stable protocol or infrastructure task and is already needed in several places
- choose a dependency with a clear support model and understandable documentation
- prefer the standard library if it covers the task without architectural losses

Not allowed:

- add a package only for one call that would take a few lines of project code
- pull in a dependency for "prettier" syntax
- add a library if it duplicates a tool already used in the project

## Good Practices

- before adding a dependency, state which long-term task it solves
- check whether the task can be covered by existing project libraries
- evaluate not only API convenience but also the maintenance cost of the dependency
