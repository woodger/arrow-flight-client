import { createChannel, createClient } from 'nice-grpc';
import { FlightServiceDefinition } from '../generated/Flight';
import type { Channel } from 'nice-grpc';

export interface FlightClientOptions {
  tls?: boolean
  metadata?: Record<string, string>
}

export class FlightClient {
  private channel: Channel;
  private client;

  constructor(
    address: string,
    options: FlightClientOptions = {}
  ) {
    this.channel = createChannel(
      address,
      options.tls
        ? { ssl: true }
        : { ssl: false }
    );

    this.client = createClient(FlightServiceDefinition, this.channel);
  }

  get grpc() {
    return this.client;
  }

  async close() {
    await this.channel.close();
  }
}
