"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const flight_client_1 = require("./flight-client");
const Flight_1 = require("../generated/Flight");
(0, node_test_1.describe)('class FlightClient', () => {
    (0, node_test_1.test)('should create FlightClient instance', () => {
        const client = new flight_client_1.FlightClient('localhost:1234');
        (0, node_assert_1.default)(client.grpc, 'Client should have grpc property');
    });
    (0, node_test_1.test)('should handle TLS option', () => {
        const opts = { tls: true };
        const client = new flight_client_1.FlightClient('localhost:1234', opts);
        (0, node_assert_1.default)(client.grpc, 'TLS client should have grpc property');
    });
    (0, node_test_1.test)('should accept metadata', () => {
        const opts = { metadata: { authorization: 'Bearer token' } };
        const client = new flight_client_1.FlightClient('localhost:1234', opts);
        (0, node_assert_1.default)(client.grpc, 'Client with metadata should have grpc property');
    });
    (0, node_test_1.test)('FlightDescriptor minimal construction', () => {
        const descriptor = {
            type: Flight_1.FlightDescriptor_DescriptorType.PATH,
            path: ['example'],
            cmd: Buffer.alloc(0)
        };
        node_assert_1.default.strictEqual(descriptor.type, Flight_1.FlightDescriptor_DescriptorType.PATH);
        node_assert_1.default.deepStrictEqual(descriptor.path, ['example']);
        node_assert_1.default.ok(Buffer.isBuffer(descriptor.cmd));
    });
    (0, node_test_1.test)('FlightData minimal construction', () => {
        const descriptor = {
            type: Flight_1.FlightDescriptor_DescriptorType.PATH,
            path: ['example'],
            cmd: Buffer.alloc(0)
        };
        const data = {
            flightDescriptor: descriptor,
            dataHeader: Buffer.alloc(0),
            dataBody: Buffer.from([1, 2, 3]),
            appMetadata: Buffer.alloc(0)
        };
        node_assert_1.default.strictEqual(data.flightDescriptor.type, Flight_1.FlightDescriptor_DescriptorType.PATH);
        node_assert_1.default.ok(Buffer.isBuffer(data.dataBody));
        node_assert_1.default.deepStrictEqual([...data.dataBody], [1, 2, 3]);
    });
});
//# sourceMappingURL=flight-client.test.js.map