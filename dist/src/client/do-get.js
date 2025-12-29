"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doGetTable = doGetTable;
const apache_arrow_1 = require("apache-arrow");
/**
 * Выполняет doGet запрос к Flight-серверу.
 * @param ticket - объект Ticket, содержащий идентификатор набора данных.
 * @returns AsyncIterable<FlightData> — поток данных FlightData.
 *
 * Пример:
 * ```ts
 * for await (const batch of client.grpc.doGet(ticket)) {
 *   console.log(batch);
 * }
 * ```
 */
async function doGetTable(client, ticket) {
    const request = {
        ticket: Buffer.from(ticket)
    };
    const stream = client.grpc.doGet(request);
    const chunks = [];
    for await (const message of stream) {
        if (message.dataBody) {
            chunks.push(message.dataBody);
        }
    }
    return (0, apache_arrow_1.tableFromIPC)(Buffer.concat(chunks));
}
//# sourceMappingURL=do-get.js.map