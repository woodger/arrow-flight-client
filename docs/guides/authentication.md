# Authentication Guide

This guide contains code snippets for configuring authentication with a Flight
server listening on `localhost:8815`. See the [main guides index](./index.md)
for discovery, downloads, streaming, and uploads.

## Bearer Token

Configured metadata is sent with every high-level client call:

```ts
import { FlightClient } from 'arrow-flight-client';

async function main() {
  const client = new FlightClient('localhost:8815', {
    metadata: {
      authorization: 'Bearer my-secret-token'
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
```

## Mutual TLS

Provide the trusted root certificates and the client identity when the server
requires mutual TLS:

```ts
import fs from 'node:fs';
import { FlightClient } from 'arrow-flight-client';

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
```

Certificate paths are resolved from the process working directory. The private
key and certificate chain form one client identity and must be configured
together.
