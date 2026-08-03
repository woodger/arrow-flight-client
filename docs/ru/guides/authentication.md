# Руководство по аутентификации

[English](../../guides/authentication.md) | Русский | [简体中文](../../zh/guides/authentication.md)

Это руководство содержит фрагменты кода для настройки аутентификации с сервером
Flight, который слушает `localhost:8815`. Сценарии обнаружения, загрузки,
потоковой обработки и отправки данных приведены в
[основном индексе руководств](./index.md).

## Bearer token

Настроенные метаданные отправляются с каждым высокоуровневым вызовом клиента:

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

Если сервер требует mutual TLS, передайте доверенные корневые сертификаты и
идентификационные данные клиента:

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

Пути к сертификатам разрешаются относительно текущего рабочего каталога
процесса. Приватный ключ и цепочка сертификатов образуют один набор
идентификационных данных клиента и должны задаваться вместе.
