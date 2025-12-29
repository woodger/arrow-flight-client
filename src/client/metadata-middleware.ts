import { ClientMiddleware, CallOptions } from 'nice-grpc';
import { Metadata } from 'nice-grpc-common';

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
export function metadataMiddleware(headers: Record<string, string | string[]>): ClientMiddleware {
  return async function* (call, options: CallOptions) {
    // Создаём объект Metadata для nice-grpc
    const metadata = new Metadata();

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
  }
}
