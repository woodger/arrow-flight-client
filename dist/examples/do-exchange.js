"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
async function main() {
    const client = new src_1.FlightClient('localhost:8815');
    const descriptor = {
        type: 'PATH',
        path: ['exchange']
    };
    const stream = client.grpc.doExchange();
    // Send request
    await stream.write({
        flightDescriptor: descriptor
    });
    // Read responses
    for await (const response of stream) {
        console.log('Received:', response);
    }
    await stream.end();
    await client.close();
}
main().catch(console.error);
//# sourceMappingURL=do-exchange.js.map