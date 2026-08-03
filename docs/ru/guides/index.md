# Руководства

[English](../../guides/index.md) | Русский

Эти руководства для пользователей объясняют распространённые сценарии
`arrow-flight-client` с готовыми для копирования фрагментами кода TypeScript. Это
документация, а не самостоятельные запускаемые проекты с примерами. Во
фрагментах предполагается, что сервер Arrow Flight слушает `localhost:8815`.

Установите клиент и его обязательную peer-зависимость Arrow:

```sh
npm install arrow-flight-client apache-arrow@^21.1.0
```

Пакет не содержит сервер Flight. Дескрипторы, тикеты, действия и способ
аутентификации определяются приложением, поэтому адаптируйте эти значения к
используемому серверу. См. также
[руководство по аутентификации](./authentication.md).

## Получение списка Flight-ресурсов

Потоково обработайте Flight-ресурсы, объявленные сервером:

```ts
import { FlightClient } from 'arrow-flight-client';

async function main() {
  const client = new FlightClient('localhost:8815');

  try {
    console.log('Available flights:');

    for await (const flight of client.listFlights()) {
      console.log('-', flight.descriptor);
    }
  }
  finally {
    await client.close();
  }
}

main().catch(console.error);
```

## Загрузка таблицы

Найдите первый объявленный endpoint с тикетом и соберите его поток в таблицу
Arrow:

```ts
import { FlightClient } from 'arrow-flight-client';

async function main() {
  const client = new FlightClient('localhost:8815');

  try {
    for await (const flight of client.listFlights()) {
      const ticket = flight.endpoints[0]?.ticket;

      if (ticket) {
        const table = await client.getTable(ticket);
        console.log(table.toString());
        return;
      }
    }

    throw new Error('No Flight endpoint with a ticket was found');
  }
  finally {
    await client.close();
  }
}

main().catch(console.error);
```

## Потоковая обработка RecordBatch

Используйте `doGet()`, когда ответ нужно обрабатывать последовательно, а не
собирать в одну таблицу:

```ts
import { FlightClient } from 'arrow-flight-client';

async function main() {
  const client = new FlightClient('localhost:8815');

  try {
    for await (const flight of client.listFlights()) {
      const ticket = flight.endpoints[0]?.ticket;

      if (!ticket) {
        continue;
      }

      const reader = await client.doGet(ticket);

      for await (const chunk of reader) {
        if (chunk.data) {
          console.log('Batch rows:', chunk.data.numRows);
        }
      }

      return;
    }

    throw new Error('No Flight endpoint with a ticket was found');
  }
  finally {
    await client.close();
  }
}

main().catch(console.error);
```

## Отправка таблицы

Отправьте таблицу Arrow и обработайте прикладные метаданные, возвращённые
сервером:

```ts
import { FlightClient, pathDescriptor } from 'arrow-flight-client';
import { tableFromArrays } from 'apache-arrow';

async function main() {
  const client = new FlightClient('localhost:8815');

  const table = tableFromArrays({
    id: [4, 5, 6],
    name: ['Dave', 'Eve', 'Frank']
  });

  try {
    for await (const result of client.doPut(
      pathDescriptor('uploaded', 'table'),
      table
    )) {
      console.log('Server metadata:', result.appMetadata);
    }

    console.log('Table uploaded');
  }
  finally {
    await client.close();
  }
}

main().catch(console.error);
```

`Handshake` и `DoExchange` остаются доступными через `FlightClient.raw`, а
соответствующие отобранные сообщения и кодеки — через корневое пространство имён
`flightProtocol`. Вызывающий код самостоятельно отвечает за фрейминг Arrow IPC
низкоуровневых вызовов `DoExchange`.
