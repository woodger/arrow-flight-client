import { ClientMiddleware } from 'nice-grpc';
export declare function metadataMiddleware(headers: Record<string, string | string[]>): ClientMiddleware;
