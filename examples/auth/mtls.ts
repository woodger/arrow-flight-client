import fs from 'node:fs';
import { FlightClient } from '../../src';

async function main() {
  const client = new FlightClient('localhost:8815', {
    tls: {
      rootCertificates: fs.readFileSync('./certs/ca.pem'),
      privateKey: fs.readFileSync('./certs/client.key'),
      certificateChain: fs.readFileSync('./certs/client.pem')
    }
  });

  try {
    for await (const flight of client.listFlights()) {
      console.log(flight);
    }
  }
  finally {
    await client.close();
  }
}

main().catch(console.error);
