# Non-Functional Requirements

> Type: Policy. This document defines the non-functional properties of the project that a working change must not violate.

Changes must not break:

- build reproducibility
- determinism
- portability
- CI
- runtime behavior
- file structure
- gRPC channel and stream lifecycle
- Arrow Flight and Arrow IPC framing
- public package exports
- publish output layout
- architecture
- dependencies

Even if the code works,
a change is forbidden if it violates these properties.

## Risk Examples

- the build passes locally but depends on file ordering in a specific OS
- the code works but moves `dist/index.js` away from the entrypoint declared in `package.json`
- the change does not break logic but adds a dependency on shell-specific behavior
- tests pass but a Flight stream loses IPC headers or changes message order
- a helper works locally but leaks generated implementation types into the stable public API

## Good Practices

- verify not only result correctness but also preservation of previous side effects
- avoid changes that bind the project to a specific execution environment
- separately evaluate the impact of a change on CI, file structure, and reproducibility
