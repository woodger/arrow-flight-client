import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { flightProtocol } from './index';
import { FlightServiceDefinition } from './flight-protocol';

describe('Package entrypoint integration', () => {
  test('exposes the Flight protocol facade', () => {
    assert.strictEqual(
      flightProtocol.FlightServiceDefinition,
      FlightServiceDefinition
    );
  });
});
