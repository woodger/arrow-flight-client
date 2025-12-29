"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlightClient = void 0;
const nice_grpc_1 = require("nice-grpc");
const Flight_1 = require("../generated/Flight");
class FlightClient {
    channel;
    client;
    constructor(address, options = {}) {
        this.channel = (0, nice_grpc_1.createChannel)(address, options.tls
            ? { ssl: true }
            : { ssl: false });
        this.client = (0, nice_grpc_1.createClient)(Flight_1.FlightServiceDefinition, this.channel);
    }
    get grpc() {
        return this.client;
    }
    async close() {
        await this.channel.close();
    }
}
exports.FlightClient = FlightClient;
//# sourceMappingURL=FlightClient.js.map