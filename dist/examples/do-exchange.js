"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const Flight_1 = require("../src/generated/Flight");
async function main() {
    const client = new src_1.FlightClient('localhost:8815');
    const stream = client.grpc.doExchange();
    await stream.write({
        flightDescriptor: {
            type: Flight_1.FlightDescriptor_DescriptorType.PATH,
            path: ['exchange']
        }
    });
    for await (const response of stream) {
        console.log('Received:', response);
    }
    await stream.end();
    await client.close();
}
main().catch(console.error);
//# sourceMappingURL=do-exchange.js.map