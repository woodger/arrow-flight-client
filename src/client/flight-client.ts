import { createChannel, createClient } from 'nice-grpc';
import { credentials } from '@grpc/grpc-js';
import { FlightServiceDefinition } from '../generated/Flight';
import { metadataMiddleware } from './metadata-middleware';

export interface FlightClientOptions {
  tls?: boolean
  metadata?: Record<string, string | string[]>
}

export class FlightClient {
  private channel;
  private client;

  constructor(
    address: string,
    options: FlightClientOptions = {},
    grpcClient?: any
  ) {
    if (grpcClient) {
      this.client = grpcClient;
      return;
    }
    
    const creds = options.tls
      ? credentials.createSsl()
      : credentials.createInsecure();

    this.channel = createChannel(
      address,
      creds,
      options.metadata
        ? {
            clientMiddleware: [
              metadataMiddleware(options.metadata),
            ],
          }
        : undefined
    );

    this.client = createClient(
      FlightServiceDefinition,
      this.channel
    );
  }

  get grpc() {
    return this.client;
  }

  async close() {
    await this.channel.close();
  }
}
