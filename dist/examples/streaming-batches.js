"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const apache_arrow_1 = require("apache-arrow");
async function main() {
    const client = new src_1.FlightClient('localhost:8815');
    const flights = await (0, src_1.listFlights)(client);
    const ticket = flights[0].endpoint[0].ticket.ticket;
    const stream = client.grpc.doGet({ ticket });
    const chunks = [];
    for await (const data of stream) {
        if (data.dataBody) {
            chunks.push(data.dataBody);
        }
    }
    const reader = await apache_arrow_1.RecordBatchReader.from(Buffer.concat(chunks));
    for await (const batch of reader) {
        console.log('Batch rows:', batch.numRows);
    }
    await client.close();
}
main().catch(console.error);
//# sourceMappingURL=streaming-batches.js.map