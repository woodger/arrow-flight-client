"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../../src");
async function main() {
    const client = new src_1.FlightClient('localhost:8815', {
        metadata: {
            authorization: 'Bearer my-secret-token'
        }
    });
    const flights = await (0, src_1.listFlights)(client);
    console.log(flights);
    await client.close();
}
main().catch(console.error);
//# sourceMappingURL=bearer.js.map