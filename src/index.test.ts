import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flightProtocol } from './index';

test('package root exposes the curated Flight protocol namespace', () => {
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
  const request: flightProtocol.FlightProtocolInput<
    flightProtocol.HandshakeRequest
  > = {
    payload: Buffer.from('credentials')
  };
  const message = flightProtocol.HandshakeRequest.create(request);
  const encoded = flightProtocol.HandshakeRequest.encode(message).finish();
  const decoded = flightProtocol.HandshakeRequest.decode(encoded);
  const metadata = flightProtocol.RawMetadata({ authorization: 'Bearer token' });
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

  assert.strictEqual(decoded.protocolVersion, 0);
  assert.strictEqual(decoded.payload.toString(), 'credentials');
  assert.strictEqual(metadata.get('authorization'), 'Bearer token');
  assert.strictEqual(
    flightProtocol.FlightServiceDefinition.methods.doExchange.name,
    'DoExchange'
  );
  assert.deepStrictEqual(
    Object.keys(rawClientMethods).sort(),
    Object.keys(flightProtocol.FlightServiceDefinition.methods).sort()
  );
  assert.deepStrictEqual(Object.keys(flightProtocol).sort(), publicValues);
});
