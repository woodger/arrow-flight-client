"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const grpc_js_1 = require("@grpc/grpc-js");
const nice_grpc_1 = require("nice-grpc");
const Flight_1 = require("../../src/generated/Flight");
async function main() {
    const rootCert = fs_1.default.readFileSync('./certs/ca.pem');
    const key = fs_1.default.readFileSync('./certs/client.key');
    const cert = fs_1.default.readFileSync('./certs/client.pem');
    const channel = (0, nice_grpc_1.createChannel)('localhost:8815', grpc_js_1.credentials.createSsl(rootCert, key, cert));
    const client = (0, nice_grpc_1.createClient)(Flight_1.FlightServiceDefinition, channel);
    const flights = [];
    for await (const item of client.listFlights({})) {
        flights.push(item);
    }
    console.log(flights);
    await channel.close();
}
main().catch(console.error);
//# sourceMappingURL=mtls.js.map