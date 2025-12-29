"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const apache_arrow_1 = require("apache-arrow");
async function main() {
    const client = new src_1.FlightClient('localhost:8815');
    const flights = await (0, src_1.listFlights)(client);
    const ticket = flights[0].endpoint[0].ticket.ticket;
    const stream = client.grpc.doGet({ ticket });
    const messageReader = new apache_arrow_1.MessageReader();
    for await (const flightData of stream) {
        if (!flightData.dataHeader || !flightData.dataBody) {
            continue;
        }
        const message = messageReader.readMessage(flightData.dataHeader, flightData.dataBody);
        if (message?.isRecordBatch()) {
            const batch = message.body;
            console.log('Batch rows:', batch.length);
        }
    }
    await client.close();
}
main().catch(console.error);
//# sourceMappingURL=streaming-batches.js.map