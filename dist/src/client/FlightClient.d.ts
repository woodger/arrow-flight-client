export interface FlightClientOptions {
    tls?: boolean;
    metadata?: Record<string, string>;
}
export declare class FlightClient {
    private channel;
    private client;
    constructor(address: string, options?: FlightClientOptions);
    get grpc(): any;
    close(): Promise<void>;
}
