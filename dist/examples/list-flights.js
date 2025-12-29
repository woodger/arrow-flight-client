"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
async function main() {
    const client = new src_1.FlightClient('localhost:8815');
    const flights = await (0, src_1.listFlights)(client);
    console.log('Available flights:');
    for (const flight of flights) {
        console.log('-', flight.flightDescriptor?.path);
    }
    await client.close();
}
main().catch(console.error);
//# sourceMappingURL=list-flights.js.map