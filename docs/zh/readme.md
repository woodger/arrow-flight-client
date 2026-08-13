# 面向 Node.js 的 Apache Arrow Flight 客户端

[English](../../readme.md) | [Русский](../ru/readme.md) | 简体中文

[![npm version](https://img.shields.io/npm/v/arrow-flight-client.svg)](https://www.npmjs.com/package/arrow-flight-client)
[![node](https://img.shields.io/node/v/arrow-flight-client.svg)](https://www.npmjs.com/package/arrow-flight-client)
[![types](https://img.shields.io/npm/types/arrow-flight-client.svg)](https://www.npmjs.com/package/arrow-flight-client)
[![license](https://img.shields.io/npm/l/arrow-flight-client.svg)](../../LICENSE)

> 实验性功能：公共 API 在 `1.0.0` 版本发布前可能发生变化。

这是一个基于 TypeScript 的
[Apache Arrow Flight 协议](https://arrow.apache.org/docs/format/Flight.html)
客户端，使用 `apache-arrow`、`nice-grpc` 和官方 Flight protobuf 合约构建。

该包提供流式 Node.js API，用于 Flight 发现、获取数据模式、执行 `DoGet`、
`DoPut` 和操作。Arrow IPC 帧处理和生成的 protobuf 值仍属于高级 API 的内部
实现。

该库仅提供客户端，不实现 Arrow Flight 服务器。

## 要求

- 包使用方需要 Node.js `>=16.9.0`；
- 直接对等依赖 `apache-arrow@^21.1.0`；
- 集成场景需要 Arrow Flight 服务器。

参与项目开发需要 Node.js `^20.19.0 || >=22.12.0`，因为项目的开发工具链要求
使用该版本范围。

## 安装

```sh
npm install arrow-flight-client apache-arrow@^21.1.0
```

应用程序和客户端必须解析到同一个 `apache-arrow` 运行时实例。这样可以确保
Arrow `Table`、`RecordBatch`、数据模式和 IPC 写入器的类标识保持一致；不受
支持的主版本或同一主版本的重复安装都不是兼容的传输边界。

## 快速开始

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

## 流式 DoGet

`doGet()` 不会收集完整响应。它返回一个读取器，其中的每个数据块都保留 Arrow
记录批次与 Flight 应用元数据之间的对应关系：

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

只有在确实需要将完整数据流收集为 Arrow `Table` 时才使用 `getTable()`。

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

`doPut()` 也接受同步或异步的 `RecordBatch` 可迭代对象。如果可迭代对象可能为空，
请传入 `FlightPutOptions.schema`。`putTable()` 是一个便捷方法，用于收集所有
`PutResult` 消息。设置 `FlightPutOptions.appMetadata` 后，客户端会在数据模式
之后立即将其作为独立的 Flight 元数据消息发送；即使可迭代对象为空也是如此。

请限制单个记录批次的大小。同一个 `DoPut` 流中的一份逻辑负载可以跨越任意数量
的批次；客户端会逐批发送，但不会自动拆分 `RecordBatch`。

## TLS、元数据与取消

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

单次调用的元数据会替换客户端配置中同名的值；传入空数组可在该次调用中移除已
配置的键。使用双向 TLS 时，私钥和证书链必须同时提供。消息大小限制以字节为
单位，并映射到 gRPC 的接收和发送限制。除 Arrow 数据体大小外，还应为序列化后的
`FlightData` 外层消息预留空间；提高限制不能替代对记录批次大小的控制。`-1`
会禁用相应限制，与不受信任的服务器通信时应谨慎使用。截止时间到期会以
`nice-grpc` 的 `ClientError` 拒绝调用，其错误码为 `DEADLINE_EXCEEDED`；通过
调用方提供的 `signal` 取消时则以 `AbortError` 拒绝调用。

## 公共 API

包根目录保持扁平且稳定的高级 API，其中包括：

- `FlightClient` 以及调用和客户端选项类型；
- `pathDescriptor()` 和 `commandDescriptor()`；
- 流式方法 `listFlights()`、`doGet()`、`doPut()`、`doAction()` 和
  `listActions()`；
- 一元方法 `getFlightInfo()`、`pollFlightInfo()` 和 `getSchema()`；
- 用于缓冲结果的便捷方法 `getTable()` 和 `putTable()`。

早期提供的独立函数 `listFlights`、`getFlightInfo`、`doGetTable` 和
`doPutTable` 仍作为兼容性辅助函数保留。

经过筛选的 protobuf 消息、编解码器、枚举、服务定义和底层客户端类型集中在包
根目录的 `flightProtocol` 命名空间中。底层客户端通过 `flightClient.raw`
公开；原来的 `flightClient.grpc` 名称仍作为已弃用别名保留。

现有底层导入方式应迁移到该命名空间：

```ts
import { flightProtocol } from 'arrow-flight-client';

const request = flightProtocol.Ticket.create({ ticket });
type RawClient = flightProtocol.FlightRawClient;
```

API 边界和有意保留的限制记录在
[公共 API 设计](./public-api.md)中。更多场景请参阅
[使用指南](./guides/index.md)。

## 当前限制

- `Handshake` 和 `DoExchange` 目前需要通过 `FlightClient.raw` 调用，并且调用
  方负责处理 `DoExchange` 的 Arrow IPC 帧；
- 尚未实现基于 endpoint location 的自动路由；`DoGet` 使用当前客户端；
- 传输失败目前直接暴露为 `nice-grpc` 错误；
- 实时互操作性测试套件目前仅在 Linux 上以 PyArrow 24 为目标，而不是覆盖多个
  服务器版本的兼容性矩阵。

## 开发

使用 npm 安装锁定的依赖树，然后运行仓库检查：

```sh
npm ci
npm run lint
npm run build
npm test
```

修改 `contracts/Flight.proto` 后，请重新生成绑定：

```sh
npm run generate:proto
```

该命令使用项目中固定版本的 `ts-proto` 生成器和 `grpc-tools` 编译器。

测试针对编译后的 JavaScript 运行，因此修改 TypeScript 源文件后，应先执行
`npm run build` 再执行 `npm test`。发布包时会通过 `prepack` 触发构建。

实时 Node-to-PyArrow 测试套件独立于单元测试命令。请在虚拟环境中安装其固定
版本的依赖，构建项目，然后将该环境中的 Python 解释器路径传给测试套件：

```sh
PYARROW_VENV="$(mktemp -d)"
python3 -m venv "$PYARROW_VENV"
"$PYARROW_VENV/bin/python" -m pip install -r test/pyarrow/requirements.txt
npm run build
PYTHON="$PYARROW_VENV/bin/python" npm run test:pyarrow
```

Flight 协议源文件是
[`contracts/Flight.proto`](../../contracts/Flight.proto)。
[`src/generated/Flight.ts`](https://github.com/woodger/arrow-flight-client/blob/v0.0.14/src/generated/Flight.ts)
是生成代码，不应手动编辑。开发和评审规则记录在
[项目策略](https://github.com/woodger/arrow-flight-client/blob/main/docs/policy/index.md)
中，发布历史记录在 [changelog](../../CHANGELOG.md) 中。

## 免责声明

本项目是独立实现，与 Apache Software Foundation 及其关联机构无关。产品和
公司名称仅用于说明与公共 API 的兼容性。

有关第三方合约和生成代码的信息，请参阅 [LICENSE](../../LICENSE)。
