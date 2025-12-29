"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
async function main() {
    const client = new src_1.FlightClient('localhost:8815');
    const flights = await (0, src_1.listFlights)(client);
    const flight = flights[0];
    const ticket = flight.endpoint?.[0].ticket?.ticket;
    if (!ticket) {
        throw new Error('No ticket found');
    }
    const table = await (0, src_1.doGetTable)(client, ticket);
    console.log(table.toString());
    await client.close();
}
main().catch(console.error);
//# sourceMappingURL=get-table.js.map