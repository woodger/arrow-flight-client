"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlightClient = void 0;
const nice_grpc_1 = require("nice-grpc");
const grpc_js_1 = require("@grpc/grpc-js");
const Flight_1 = require("../generated/Flight");
const metadata_middleware_1 = require("./metadata-middleware");
class FlightClient {
    channel;
    client;
    constructor(address, options = {}, grpcClient) {
        if (grpcClient) {
            this.client = grpcClient;
            return;
        }
        const creds = options.tls
            ? grpc_js_1.credentials.createSsl()
            : grpc_js_1.credentials.createInsecure();
        this.channel = (0, nice_grpc_1.createChannel)(address, creds, options.metadata
            ? {
                clientMiddleware: [
                    (0, metadata_middleware_1.metadataMiddleware)(options.metadata),
                ],
            }
            : undefined);
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
//# sourceMappingURL=flight-client.js.map