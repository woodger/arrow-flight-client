"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doPutTable = doPutTable;
const apache_arrow_1 = require("apache-arrow");
const Flight_1 = require("../generated/Flight");
/**
 * Выполняет doPut запрос к Flight-серверу.
 * Позволяет отправлять данные на сервер в виде FlightData.
 * @param data - объект FlightData для отправки.
 * @returns AsyncIterableIterator<void> — поток для записи данных.
 *
 * Пример:
 * ```ts
 * const stream = client.grpc.doPut();
 * await stream.write(flightData);
 * await stream.end();
 * ```
 */
async function doPutTable(client, table, path) {
    const descriptor = {
        type: Flight_1.FlightDescriptor_DescriptorType.PATH,
        path,
        cmd: Buffer.alloc(0)
    };
    const writer = client.grpc.doPut();
    const ipc = (0, apache_arrow_1.tableToIPC)(table);
    const data = {
        flightDescriptor: descriptor,
        dataHeader: Buffer.alloc(0),
        dataBody: Buffer.from(ipc),
        appMetadata: Buffer.alloc(0)
    };
    await writer.write(data);
    await writer.end();
}
//# sourceMappingURL=do-put.js.map