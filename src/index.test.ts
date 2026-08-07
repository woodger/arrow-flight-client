/**
 * Source facade tests protect the public runtime and type export surface.
 *
 * Allowed here:
 * - asserting root-level runtime export names;
 * - compiling imports of root-level type contracts;
 * - verifying namespace wiring at the source module boundary.
 *
 * This file must not verify manifest or filesystem wiring or repeat behavior
 * tests owned by exported modules.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as packageExports from './index';
import type {
  FlightAction,
  FlightActionResult,
  FlightActionType,
  FlightCallOptions,
  FlightClientOptions,
  FlightCommandDescriptor,
  FlightDataSource,
  FlightDescriptor,
  FlightEndpoint,
  FlightInfo,
  FlightMetadata,
  FlightMetadataValue,
  FlightPathDescriptor,
  FlightPollInfo,
  FlightPutOptions,
  FlightPutResult,
  FlightStreamChunk,
  FlightStreamReader,
  FlightTicket,
  FlightTlsOptions
} from './index';
import { FlightServiceDefinition } from './flight-protocol';

type RootClientTypeContracts = [
  FlightAction,
  FlightActionResult,
  FlightActionType,
  FlightCallOptions,
  FlightClientOptions,
  FlightCommandDescriptor,
  FlightDataSource,
  FlightDescriptor,
  FlightEndpoint,
  FlightInfo,
  FlightMetadata,
  FlightMetadataValue,
  FlightPathDescriptor,
  FlightPollInfo,
  FlightPutOptions,
  FlightPutResult,
  FlightStreamChunk,
  FlightStreamReader,
  FlightTicket,
  FlightTlsOptions
];

const expectedRootClientTypeContractCount: RootClientTypeContracts['length'] =
  20;

const runtimeExportNames = [
  'FlightClient',
  'FlightProtocolError',
  'commandDescriptor',
  'doGetTable',
  'doPutTable',
  'flightProtocol',
  'getFlightInfo',
  'listFlights',
  'pathDescriptor'
] as const;

describe('source facade', () => {
  test('exposes only the public runtime surface', () => {
    assert.deepStrictEqual(
      Object.keys(packageExports).sort(),
      [...runtimeExportNames].sort()
    );
  });

  test('exposes public client type contracts', () => {
    assert.strictEqual(expectedRootClientTypeContractCount, 20);
  });

  test('exposes the Flight protocol facade', () => {
    assert.strictEqual(
      packageExports.flightProtocol.FlightServiceDefinition,
      FlightServiceDefinition
    );
  });
});
