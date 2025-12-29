import fs from 'fs';
import { credentials } from '@grpc/grpc-js';
import { createChannel, createClient } from 'nice-grpc';
import { FlightServiceDefinition } from '../../src/generated/Flight';

async function main() {
  const rootCert = fs.readFileSync('./certs/ca.pem');
  const key = fs.readFileSync('./certs/client.key');
  const cert = fs.readFileSync('./certs/client.pem');

  const channel = createChannel(
    'localhost:8815',
    credentials.createSsl(rootCert, key, cert)
  );

  const client = createClient(FlightServiceDefinition, channel);
  const flights = [];

  for await (const item of client.listFlights({})) {
    flights.push(item);
  }

  console.log(flights);
  await channel.close();
}

main().catch(console.error);
