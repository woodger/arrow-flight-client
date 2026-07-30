import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as flightProtocol from './flight-protocol';

describe('Flight protocol facade', () => {
  test('exposes the curated runtime values', () => {
    const publicValues = [
      'Action',
      'ActionType',
      'BasicAuth',
      'CancelFlightInfoRequest',
      'CancelFlightInfoResult',
      'CancelStatus',
      'CloseSessionRequest',
      'CloseSessionResult',
      'CloseSessionStatus',
      'Criteria',
      'Empty',
      'FlightData',
      'FlightDescriptor',
      'FlightDescriptorType',
      'FlightEndpoint',
      'FlightInfo',
      'FlightServiceDefinition',
      'GetSessionOptionsRequest',
      'GetSessionOptionsResult',
      'HandshakeRequest',
      'HandshakeResponse',
      'Location',
      'PollInfo',
      'PutResult',
      'RawMetadata',
      'RenewFlightEndpointRequest',
      'Result',
      'SchemaResult',
      'SessionOptionStringListValue',
      'SessionOptionValue',
      'SetSessionOptionsError',
      'SetSessionOptionsErrorValue',
      'SetSessionOptionsRequest',
      'SetSessionOptionsResult',
      'Ticket'
    ];

    assert.deepStrictEqual(Object.keys(flightProtocol).sort(), publicValues);
  });

  test('exports functional message codecs', () => {
    const request: flightProtocol.FlightProtocolInput<
      flightProtocol.HandshakeRequest
    > = {
      payload: Buffer.from('credentials')
    };
    const message = flightProtocol.HandshakeRequest.create(request);
    const encoded = flightProtocol.HandshakeRequest.encode(message).finish();
    const decoded = flightProtocol.HandshakeRequest.decode(encoded);

    assert.strictEqual(decoded.protocolVersion, 0);
    assert.strictEqual(decoded.payload.toString(), 'credentials');
  });

  test('exports the raw metadata constructor', () => {
    const metadata = flightProtocol.RawMetadata({
      authorization: 'Bearer token'
    });

    assert.strictEqual(metadata.get('authorization'), 'Bearer token');
  });

  test('keeps raw client methods aligned with the service definition', () => {
    const rawClientMethods = {
      handshake: true,
      listFlights: true,
      getFlightInfo: true,
      pollFlightInfo: true,
      getSchema: true,
      doGet: true,
      doPut: true,
      doExchange: true,
      doAction: true,
      listActions: true
    } satisfies Record<keyof flightProtocol.FlightRawClient, true>;

    assert.deepStrictEqual(
      Object.keys(rawClientMethods).sort(),
      Object.keys(flightProtocol.FlightServiceDefinition.methods).sort()
    );
  });
});
