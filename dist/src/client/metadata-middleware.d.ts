import { ClientMiddleware } from 'nice-grpc';
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
export declare function metadataMiddleware(headers: Record<string, string | string[]>): ClientMiddleware;
