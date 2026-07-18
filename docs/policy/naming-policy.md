# Naming Policy

> Type: Policy. This document defines naming rules for code entities.

## Goal

Names in code must be consistent, predictable, and must not create false semantic signals.

Name notation must reflect the entity role, not the author's personal preference.

## Basic Naming Rules

TypeScript/JavaScript code uses the following rules:

- `camelCase` - variables, functions, values, exported const values;
- `PascalCase` - classes, types, interfaces, enums;
- `kebab-case` - source file names;
- `SCREAMING_SNAKE_CASE` / `ALL_CAPS` - forbidden for internal project identifiers.

## Protocol And Generated Code

Names defined by Arrow Flight, protobuf, gRPC, or a code generator retain their external spelling. Examples include `DoGet`, `FlightData`, and generated enum members.

Generated files under `src/generated/` are exempt from project naming rules and must not be renamed or edited only to match local style. Project-owned wrappers around generated contracts follow the normal TypeScript naming rules.
