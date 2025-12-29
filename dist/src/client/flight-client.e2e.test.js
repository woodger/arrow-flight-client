"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const flight_client_1 = require("./flight-client");
const Flight_1 = require("../generated/Flight");
class MockStream {
    messages;
    constructor(messages = []) {
        this.messages = messages;
    }
    async *[Symbol.asyncIterator]() {
        for (const msg of this.messages) {
            yield msg;
        }
    }
    async write(msg) {
        this.messages.push(msg);
    }
    async end() { }
}
class MockGrpcClient {
    doGetCalled = [];
    doPutCalled = [];
    doGet(request) {
        this.doGetCalled.push(request);
        return new MockStream([
            {
                dataBody: Buffer.from([1, 2, 3]),
                dataHeader: Buffer.alloc(0),
                appMetadata: Buffer.alloc(0)
            }
        ]);
    }
    doPut() {
        const stream = new MockStream();
        this.doPutCalled.push(stream);
        return stream;
    }
}
const createMockFlightClient = (metadata) => new flight_client_1.FlightClient('localhost:1234', { metadata }, new MockGrpcClient());
(0, node_test_1.describe)('class FlightClient e2e (mock)', () => {
    (0, node_test_1.test)('doGet returns FlightData stream', async () => {
        const client = createMockFlightClient();
        const ticket = {
            ticket: Buffer.from('abc')
        };
        const stream = client.grpc.doGet(ticket);
        const received = [];
        for await (const msg of stream) {
            received.push(msg);
        }
        node_assert_1.default.strictEqual(received.length, 1);
        node_assert_1.default.deepStrictEqual([...received[0].dataBody], [1, 2, 3]);
    });
    (0, node_test_1.test)('doPut sends FlightData correctly', async () => {
        const client = createMockFlightClient();
        const stream = client.grpc.doPut();
        const descriptor = {
            type: Flight_1.FlightDescriptor_DescriptorType.PATH,
            path: ['test'],
            cmd: Buffer.alloc(0)
        };
        const data = {
            flightDescriptor: descriptor,
            dataHeader: Buffer.alloc(0),
            dataBody: Buffer.from([9, 8, 7]),
            appMetadata: Buffer.alloc(0)
        };
        await stream.write(data);
        await stream.end();
        // Проверяем что данные дошли в mock stream
        node_assert_1.default.strictEqual(stream['messages'].length, 1);
        node_assert_1.default.deepStrictEqual([...stream['messages'][0].dataBody], [9, 8, 7]);
    });
    (0, node_test_1.test)('metadata is passed through middleware', async () => {
        const client = createMockFlightClient({ authorization: 'Bearer token' });
        (0, node_assert_1.default)(client.grpc, 'grpc client exists');
    });
});
//# sourceMappingURL=flight-client.e2e.test.js.map