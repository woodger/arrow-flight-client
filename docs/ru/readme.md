# Клиент Apache Arrow Flight для Node.js

[English](../../readme.md) | Русский | [简体中文](../zh/readme.md)

[![npm version](https://img.shields.io/npm/v/arrow-flight-client.svg)](https://www.npmjs.com/package/arrow-flight-client)
[![node](https://img.shields.io/node/v/arrow-flight-client.svg)](https://www.npmjs.com/package/arrow-flight-client)
[![types](https://img.shields.io/npm/types/arrow-flight-client.svg)](https://www.npmjs.com/package/arrow-flight-client)
[![license](https://img.shields.io/npm/l/arrow-flight-client.svg)](../../LICENSE)

> Экспериментальный статус: публичный API может изменяться до выпуска `1.0.0`.

Клиент на TypeScript для
[протокола Apache Arrow Flight](https://arrow.apache.org/docs/format/Flight.html),
построенный на основе `apache-arrow`, `nice-grpc` и официального protobuf-контракта
Flight.

Пакет предоставляет потоковый Node.js API для обнаружения данных, получения
схем, операций `DoGet`, `DoPut` и действий. Фрейминг Arrow IPC и
сгенерированные protobuf-значения остаются внутренними деталями
высокоуровневого API.

Это только клиентская библиотека. Она не реализует сервер Arrow Flight.

## Требования

- Node.js `>=16.9.0` для пользователей пакета;
- `apache-arrow@^21.1.0` как прямая peer-зависимость;
- сервер Arrow Flight для интеграционных сценариев.

Участникам разработки требуется Node.js `^20.19.0 || >=22.12.0`, поскольку
этот диапазон поддерживается используемыми в проекте инструментами разработки.

## Установка

```sh
npm install arrow-flight-client apache-arrow@^21.1.0
```

Приложение и клиент должны разрешать один и тот же экземпляр `apache-arrow` во
время выполнения. Благодаря этому `Table`, `RecordBatch`, схемы и IPC writers
Arrow относятся к одним и тем же runtime-классам. Неподдерживаемые или
дублирующиеся мажорные версии не образуют совместимую транспортную границу.

## Быстрый старт

```ts
import { FlightClient, pathDescriptor } from 'arrow-flight-client';

const client = new FlightClient('localhost:8815');

try {
  for await (const flight of client.listFlights()) {
    console.log(flight.descriptor, flight.endpoints);
  }

  const info = await client.getFlightInfo(
    pathDescriptor('database', 'table')
  );
  const ticket = info.endpoints[0]?.ticket;

  if (!ticket) {
    throw new Error('The Flight endpoint has no ticket');
  }

  const table = await client.getTable(ticket);
  console.log(table.toString());
}
finally {
  await client.close();
}
```

## Потоковый DoGet

`doGet()` не накапливает полный ответ. Метод возвращает средство чтения, элементы
которого сохраняют связь между объектами Arrow `RecordBatch` и прикладными
метаданными Flight:

```ts
const reader = await client.doGet(ticket);

for await (const chunk of reader) {
  if (chunk.data) {
    console.log('Rows:', chunk.data.numRows);
  }

  if (chunk.appMetadata) {
    console.log('Metadata:', chunk.appMetadata);
  }
}
```

Используйте `getTable()`, когда полное накопление потока в Arrow `Table`
является намеренным.

## DoPut

```ts
import { tableFromArrays } from 'apache-arrow';
import { FlightClient, pathDescriptor } from 'arrow-flight-client';

const table = tableFromArrays({ id: [1, 2], name: ['one', 'two'] });

for await (const result of client.doPut(
  pathDescriptor('uploaded', 'table'),
  table
)) {
  console.log('Server metadata:', result.appMetadata);
}
```

`doPut()` также принимает синхронные и асинхронные итерируемые коллекции
`RecordBatch`. Передавайте `FlightPutOptions.schema`, если такая коллекция может
быть пустой. `putTable()` — вспомогательный метод, который собирает все сообщения
`PutResult`. Если задано `FlightPutOptions.appMetadata`, клиент отправляет
метаданные отдельным сообщением Flight сразу после схемы, в том числе для
пустой коллекции.

Ограничивайте размер отдельных объектов `RecordBatch`. Одна логическая полезная
нагрузка может занимать любое количество пакетов в одном потоке `DoPut`: клиент
передаёт их последовательно, но не разбивает `RecordBatch` автоматически.

## TLS, метаданные и отмена

```ts
const client = new FlightClient('flight.example.com:443', {
  tls: {
    rootCertificates,
    privateKey,
    certificateChain
  },
  metadata: {
    authorization: 'Bearer my-token'
  },
  maxReceiveMessageLength: 64 * 1024 * 1024,
  maxSendMessageLength: 64 * 1024 * 1024
});

const controller = new AbortController();

const info = await client.getFlightInfo(descriptor, {
  signal: controller.signal,
  deadline: new Date(Date.now() + 5_000),
  metadata: {
    'x-request-id': 'request-1'
  }
});
```

Метаданные отдельного вызова заменяют настроенные значения с тем же ключом;
пустой массив удаляет настроенный ключ для одного вызова. Для mutual TLS
приватный ключ и цепочка сертификатов должны передаваться вместе. Ограничения
размера сообщений задаются в байтах и соответствуют gRPC-ограничениям на приём
и отправку. Учитывайте размер сериализованной оболочки `FlightData` сверх размера
тела Arrow; увеличение лимита не заменяет ограничение объектов `RecordBatch`.
Значение
`-1` отключает лимит и должно осторожно использоваться с недоверенными
серверами. Истёкший `deadline` отклоняет вызов с ошибкой `ClientError` из
`nice-grpc`, имеющей код `DEADLINE_EXCEEDED`; отмена через переданный вызывающим
кодом `signal` отклоняет вызов с `AbortError`.

## Публичный API

Корень пакета сохраняет плоский стабильный высокоуровневый API. В него входят:

- `FlightClient` и типы опций клиента и вызовов;
- `pathDescriptor()` и `commandDescriptor()`;
- потоковые методы `listFlights()`, `doGet()`, `doPut()`, `doAction()` и
  `listActions()`;
- унарные методы `getFlightInfo()`, `pollFlightInfo()` и `getSchema()`;
- вспомогательные буферизующие методы `getTable()` и `putTable()`.

Ранее существовавшие отдельные функции `listFlights`, `getFlightInfo`,
`doGetTable` и `doPutTable` остаются доступными как средства совместимости.

Отобранные protobuf-сообщения, кодеки, перечисления, определение сервиса и типы
низкоуровневого клиента сгруппированы в пространстве имён `flightProtocol` в
корне пакета. Низкоуровневый клиент доступен как `flightClient.raw`; прежнее имя
`flightClient.grpc` остаётся устаревшим псевдонимом.

Существующие низкоуровневые импорты переносятся в пространство имён:

```ts
import { flightProtocol } from 'arrow-flight-client';

const request = flightProtocol.Ticket.create({ ticket });
type RawClient = flightProtocol.FlightRawClient;
```

Границы API и намеренные ограничения описаны в документе
[об устройстве публичного API](./public-api.md). Дополнительные сценарии
приведены в [руководствах для пользователей](./guides/index.md).

## Текущие ограничения

- Для `Handshake` и `DoExchange` сейчас требуется `FlightClient.raw`, а
  вызывающий код самостоятельно отвечает за фрейминг Arrow IPC для `DoExchange`;
- автоматическая маршрутизация по местоположениям endpoint не реализована:
  `DoGet` использует текущий клиент;
- транспортные ошибки сейчас предоставляются как ошибки `nice-grpc`;
- live-набор проверок совместимости сейчас проверяет PyArrow 24 в Linux, а не
  матрицу совместимости нескольких версий сервера.

## Разработка

Установите зафиксированное дерево зависимостей через npm и запустите проверки
репозитория:

```sh
npm ci
npm run lint
npm run build
npm test
```

Перед изменением `contracts/Flight.proto` соберите репозиторный CLI:

```sh
npm run build
```

После изменения контракта заново сгенерируйте привязки и повторите сборку:

```sh
npm run generate:proto
npm run build
```

Команда генерации использует скомпилированный репозиторный CLI, закреплённый в
проекте генератор `ts-proto` и компилятор `grpc-tools`.

Тесты запускаются над скомпилированным JavaScript, поэтому после изменения
исходников TypeScript выполните `npm run build` перед `npm test`. При публикации
пакета сборка вызывается через `prepack`.

Live-набор Node-to-PyArrow отделён от команды unit-тестов. Установите его
закреплённую зависимость в виртуальное окружение, соберите проект и передайте
набору путь к Python из этого окружения:

```sh
PYARROW_VENV="$(mktemp -d)"
python3 -m venv "$PYARROW_VENV"
"$PYARROW_VENV/bin/python" -m pip install -r test/pyarrow/requirements.txt
npm run build
PYTHON="$PYARROW_VENV/bin/python" npm run test:pyarrow
```

Исходный Flight-контракт находится в
[`contracts/Flight.proto`](../../contracts/Flight.proto).
[`src/generated/Flight.ts`](https://github.com/woodger/arrow-flight-client/blob/v0.0.15/src/generated/Flight.ts)
является сгенерированным кодом и не должен редактироваться вручную. Правила
разработки и ревью описаны в
[политиках проекта](https://github.com/woodger/arrow-flight-client/blob/main/docs/policy/index.md),
а история релизов ведётся в [changelog](../../CHANGELOG.md).

## Отказ от ответственности

Этот проект является независимой реализацией и не связан с Apache Software
Foundation или её аффилированными организациями. Названия продуктов и компаний
используются исключительно для обозначения совместимости с публичными API.

Информация о сторонних контрактах и сгенерированном коде приведена в
[LICENSE](../../LICENSE).
