# 使用指南

[English](../../guides/index.md) | [Русский](../../ru/guides/index.md) | 简体中文

这些使用指南通过可复制的 TypeScript 代码片段说明
`arrow-flight-client` 的常见用法。它们是文档，而不是可独立运行的示例项目。
代码片段假定 Arrow Flight 服务器正在监听 `localhost:8815`。

安装客户端及其必需的 Arrow 对等依赖：

```sh
npm install arrow-flight-client apache-arrow@^21.1.0
```

该包不包含 Flight 服务器。描述符、票据、操作和身份验证均由应用程序定义，
因此请根据所使用的服务器调整这些值。另请参阅
[身份验证指南](./authentication.md)。

## 列出 Flight

以流式方式处理服务器公布的 Flight：

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

## 下载表

查找第一个带有票据的已公布 endpoint，并将其数据流收集为 Arrow 表：

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

## 流式处理记录批次

需要逐步处理响应而不是将其收集为一个表时，请使用 `doGet()`：

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

## 上传表

上传 Arrow 表，并处理服务器返回的应用元数据：

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

`Handshake` 和 `DoExchange` 仍可通过 `FlightClient.raw` 使用，相应的经过筛选的
消息和编解码器位于根 `flightProtocol` 命名空间中。底层 `DoExchange` 调用的
Arrow IPC 帧处理由调用方负责。
