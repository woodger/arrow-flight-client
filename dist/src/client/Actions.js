"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFlights = listFlights;
exports.getFlightInfo = getFlightInfo;
async function listFlights(client) {
    const result = [];
    for await (const flight of client.grpc.listFlights({})) {
        result.push(flight);
    }
    return result;
}
async function getFlightInfo(client, descriptor) {
    return client.grpc.getFlightInfo(descriptor);
}
//# sourceMappingURL=Actions.js.map