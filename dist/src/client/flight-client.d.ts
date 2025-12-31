/**
 * FlightClient — это TypeScript клиент для Apache Arrow Flight Protocol.
 *
 * Он предоставляет высокоуровневый доступ к gRPC-сервису Flight, включая методы:
 *  - doGet: чтение потоков FlightData по ticket
 *  - doPut: отправка потоков FlightData на сервер
 *
 * Особенности реализации:
 *  - Использует ts-proto для генерации строго типизированных protobuf-сообщений.
 *  - Использует nice-grpc v2.x с поддержкой async generators.
 *  - gRPC metadata обрабатывается через middleware, позволяя добавлять авторизацию (Bearer, mTLS и т.д.).
 *  - Поля FlightDescriptor.cmd и FlightData.dataHeader/appMetadata автоматически заполняются
 *    для соблюдения строгой типизации протокола.
 *
  * Примечание:
 * - Этот клиент находится в экспериментальной стадии (experimental).
 * - API может измениться до версии v1.0.0.
 *
 * Пример использования:
  * ```ts
 * const client = new FlightClient("localhost:8815", {
 *   tls: true,
 *   metadata: { authorization: "Bearer TOKEN" }
 * });
 *
 * const ticket = { ticket: Buffer.from("example") };
 * const stream = client.grpc.doGet(ticket);
 * for await (const batch of stream) {
 *   console.log(batch);
 * }
 * ```
 */
export interface FlightClientOptions {
    tls?: boolean;
    metadata?: Record<string, string | string[]>;
}
export declare class FlightClient {
    private channel;
    private client;
    /**
     * Создаёт новый экземпляр FlightClient.
     * @param address - Адрес gRPC-сервера Arrow Flight (например, "localhost:8815").
     * @param options - Опции клиента, включая TLS и metadata для авторизации.
     * @param grpcClient - собственный gRPC клиент для dependency injection, используется только для тестов.
     */
    constructor(address: string, options?: FlightClientOptions, grpcClient?: any);
    /**
     * Возвращает внутренний gRPC клиент (readonly).
     */
    get grpc(): any;
    /**
     * Закрывает соединение
     */
    close(): Promise<void>;
}
