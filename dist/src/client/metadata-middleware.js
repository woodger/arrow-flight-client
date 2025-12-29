"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadataMiddleware = metadataMiddleware;
const nice_grpc_common_1 = require("nice-grpc-common");
function metadataMiddleware(headers) {
    return async function* (call, options) {
        const metadata = new nice_grpc_common_1.Metadata();
        for (const [key, value] of Object.entries(headers)) {
            if (Array.isArray(value)) {
                for (const v of value) {
                    metadata.append(key, v);
                }
            }
            else {
                metadata.set(key, value);
            }
        }
        return yield* call.next(call.request, {
            ...options,
            metadata,
        });
    };
}
//# sourceMappingURL=metadata-middleware.js.map