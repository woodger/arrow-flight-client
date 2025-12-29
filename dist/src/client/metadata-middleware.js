"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadataMiddleware = metadataMiddleware;
const nice_grpc_common_1 = require("nice-grpc-common");
/**
 * middleware для передачи metadata (например, авторизации) на каждый gRPC вызов.
 *
 * Используется при создании FlightClient для добавления токена Bearer или других заголовков.
 *
 * @param metadataMap - объект ключ-значение для metadata
 * @returns ClientMiddleware — middleware для nice-grpc
 *
 * Пример:
 * ```ts
 * const middleware = metadataMiddleware({ authorization: 'Bearer TOKEN' });
 * const client = new FlightClient('localhost:8815', { clientMiddleware: [middleware] });
 * ```
 */
function metadataMiddleware(headers) {
    return async function* (call, options) {
        // Создаём объект Metadata для nice-grpc
        const metadata = new nice_grpc_common_1.Metadata();
        for (const [key, value] of Object.entries(headers)) {
            if (Array.isArray(value)) {
                for (const item of value) {
                    metadata.append(key, item);
                }
            }
            else {
                metadata.set(key, value);
            }
        }
        // Передаём вызов дальше
        return yield* call.next(call.request, {
            ...options,
            metadata
        });
    };
}
//# sourceMappingURL=metadata-middleware.js.map