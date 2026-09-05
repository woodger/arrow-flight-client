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

需要逐步处理响应而不是将其收集为一个表时，请使用 `doGet()`。此示例在读取
第一个记录批次后停止；通过 `break` 退出 `for await` 循环会关闭 reader：

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

每个 `FlightStreamReader` 只能消费一次：使用一个 `for await` 循环或调用一次
`readAll()`。再次读取会失败，在 `break` 或 `cancel()` 之后也一样。
需要新的 reader 时，请再次调用 `doGet(ticket)`。

如果打开 reader 仅为查看数据模式，且不开始迭代，请使用 `cancel()` 释放流：

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

迭代开始后也可以调用 `cancel()`：它会中止等待中的 `DoGet` 读取，并在流资源
释放后完成；该读取会以 `AbortError` 拒绝。通过 `break` 退出 `for await` 循环
会使用相同的清理路径，但不会产生取消错误。

调用方仍负责管理客户端，并在所有调用完成后使用 `client.close()` 关闭它，
如前一个示例所示。

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

## 读取错误详情

> **Unreleased:** 此示例使用 `FlightCallOptions.onTrailer` 和
> `FlightResponseMetadata`，它们在 `arrow-flight-client@0.0.15` 中不可用。
> 请参阅[更新日志](../../../CHANGELOG.md#unreleased)。

使用 `FlightCallOptions.onTrailer` 保存调用的尾随元数据，包括调用失败时的
元数据。PyArrow 的 gRPC 传输层将 `FlightError.extra_info` 作为不透明字节放在
`grpc-status-details-bin` 中，具体可参见
[Arrow 传输实现](https://github.com/apache/arrow/blob/apache-arrow-24.0.0/cpp/src/arrow/flight/transport/grpc/util_internal.cc#L297)。
回调接收文本或二进制值的数组，且不得抛出异常。在回调中保存尾随元数据，
并在处理错误时解释其内容：

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

此示例假定服务器使用 UTF-8 文本。如果内容是 JSON，请按照服务器的应用契约
解析并验证。客户端保留原始字节以及现有错误的 `code` 和 `details`。
流式调用和 `getTable()` / `putTable()` 也支持此选项；尾随元数据在 RPC 结束时
到达，而不是在首次打开 reader 时到达。若在服务器响应之前发生错误，
可能没有服务器提供的尾随元数据。
