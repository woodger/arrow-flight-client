"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doPutTable = doPutTable;
const apache_arrow_1 = require("apache-arrow");
async function doPutTable(client, table, path) {
    const descriptor = {
        type: 'PATH',
        path
    };
    const writer = client.grpc.doPut();
    const ipc = (0, apache_arrow_1.tableToIPC)(table);
    const data = {
        flightDescriptor: descriptor,
        dataBody: ipc
    };
    await writer.write(data);
    await writer.end();
}
//# sourceMappingURL=DoPut.js.map