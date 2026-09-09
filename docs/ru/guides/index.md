# Руководства

[English](../../guides/index.md) | Русский | [简体中文](../../zh/guides/index.md)

Эти руководства для пользователей объясняют распространённые сценарии `arrow-flight-client` с готовыми для копирования фрагментами кода TypeScript. Это документация, а не самостоятельные запускаемые проекты с примерами. Во фрагментах предполагается, что сервер Arrow Flight слушает `localhost:8815`.

Установите клиент и его обязательную peer-зависимость Arrow:

```sh
npm install arrow-flight-client apache-arrow@^21.1.0
```

Пакет не содержит сервер Flight. Дескрипторы, тикеты, действия и способ аутентификации определяются приложением, поэтому адаптируйте эти значения к используемому серверу. См. также [руководство по аутентификации](./authentication.md).

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

Найдите первый объявленный endpoint с тикетом и соберите его поток в таблицу Arrow:

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

Используйте `doGet()`, когда ответ нужно обрабатывать последовательно, а не собирать в одну таблицу. Этот пример останавливается после первого RecordBatch; выход из цикла `for await` через `break` закрывает reader:

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
          break;
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

Каждый `FlightStreamReader` допускает однократное чтение: используйте один цикл `for await` или один вызов `readAll()`. Повторное чтение, в том числе после `break` или `cancel()`, завершается ошибкой. Для нового чтения снова вызовите `doGet(ticket)`.

Если reader открыт только для просмотра схемы и итерация не начинается, освободите поток с помощью `cancel()`:

```ts
import type { FlightClient, FlightTicket } from 'arrow-flight-client';

export async function inspectSchema(client: FlightClient, ticket: FlightTicket) {
  const reader = await client.doGet(ticket);

  try {
    console.log(reader.schema);
  }
  finally {
    await reader.cancel();
  }
}
```

`cancel()` можно вызвать и после начала итерации: он прерывает ожидающее чтение `DoGet`, которое отклоняется с `AbortError`, и завершается после освобождения ресурсов потока. Выход из цикла `for await` через `break` использует тот же путь очистки, но не выдаёт ошибку отмены.

Вызывающий код по-прежнему владеет клиентом и закрывает его через `client.close()` после завершения всех вызовов, как в предыдущем примере.

## Отправка таблицы

Отправьте таблицу Arrow и обработайте прикладные метаданные, возвращённые сервером:

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

`Handshake` и `DoExchange` остаются доступными через `FlightClient.raw`, а соответствующие отобранные сообщения и кодеки — через корневое пространство имён `flightProtocol`. Вызывающий код самостоятельно отвечает за фрейминг Arrow IPC низкоуровневых вызовов `DoExchange`.

## Чтение деталей ошибки

Используйте `FlightCallOptions.onTrailer`, чтобы сохранить trailing metadata вызова, в том числе завершившегося ошибкой. gRPC-транспорт PyArrow передаёт `FlightError.extra_info` как непрозрачные байты в `grpc-status-details-bin`, что видно в [реализации транспорта Arrow](https://github.com/apache/arrow/blob/apache-arrow-24.0.0/cpp/src/arrow/flight/transport/grpc/util_internal.cc#L297). Callback получает массивы текстовых или бинарных значений и не должен бросать исключения. Сохраните в нём trailers, а содержимое разбирайте при обработке ошибки:

```ts
import { FlightClient, pathDescriptor } from 'arrow-flight-client';
import type { FlightResponseMetadata } from 'arrow-flight-client';

async function main() {
  const client = new FlightClient('localhost:8815');
  let trailer: FlightResponseMetadata | undefined;

  try {
    await client.getFlightInfo(pathDescriptor('model'), {
      onTrailer: (metadata) => { trailer = metadata; }
    });
  }
  catch (error) {
    const extraInfo = trailer?.['grpc-status-details-bin']?.[0];

    if (extraInfo instanceof Uint8Array) {
      console.error('Flight extra_info:', Buffer.from(extraInfo).toString('utf8'));
    }

    throw error;
  }
  finally {
    await client.close();
  }
}

main().catch(console.error);
```

В этом примере предполагается, что сервер использует текст UTF-8. Если содержимое представлено JSON, разбирайте и проверяйте его согласно прикладному контракту сервера. Клиент сохраняет байты и прежние `code` и `details` ошибки. Та же опция доступна для потоковых вызовов и `getTable()` / `putTable()`; trailers приходят при завершении RPC, а не при первоначальном открытии reader. При сбое до ответа сервера trailers от сервера могут отсутствовать.
