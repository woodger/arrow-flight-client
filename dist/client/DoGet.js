"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doGetTable = doGetTable;
const apache_arrow_1 = require("apache-arrow");
async function doGetTable(client, ticket) {
    const request = {
        ticket
    };
    const stream = client.grpc.doGet(request);
    const chunks = [];
    for await (const message of stream) {
        if (message.dataBody) {
            chunks.push(message.dataBody);
        }
    }
    const buffer = Buffer.concat(chunks);
    return (0, apache_arrow_1.tableFromIPC)(buffer);
}
//# sourceMappingURL=DoGet.js.map