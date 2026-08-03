# 公共 API 设计

[English](../public-api.md) | [Русский](../ru/public-api.md) | 简体中文

> 类型：设计。本文档记录 Node.js Arrow Flight 客户端的边界和稳定性决策。

包入口映射由 [`package.json`](../../package.json) 定义。根源码导出面以及经过
筛选的底层协议命名空间分别由
[`src/index.ts`](https://github.com/woodger/arrow-flight-client/blob/v0.0.11/src/index.ts)
和
[`src/flight-protocol.ts`](https://github.com/woodger/arrow-flight-client/blob/v0.0.11/src/flight-protocol.ts)
定义。可观察的数据流行为由与
[`src/client/`](https://github.com/woodger/arrow-flight-client/tree/v0.0.11/src/client)
源码放置在一起的测试保护，而传输合约仍由
[`contracts/Flight.proto`](../../contracts/Flight.proto) 定义。

## API 边界

包根目录导出项目自有的描述符、元数据值、响应对象和 Arrow JS 对象。生成的
protobuf 所要求的枚举成员、空 `Buffer` 字段、`dataHeader` 和 `dataBody` 等
细节不属于高级调用约定。

底层 protobuf 合约被有意集中在 `flightProtocol` 命名空间中，而不是平铺到
高级导出面。该命名空间显式导出一组 Flight 消息、编解码器、枚举、服务定义和
项目自有的 `FlightRawClient` 类型；生成器辅助函数和服务器实现类型仍为内部
实现。

`FlightClient.raw` 在现有通道上公开该底层客户端。它作为底层入口，用于尚未
提供高级封装的 Flight 操作或应用扩展。

底层调用有意保留传输层语义。其 `FlightRawCallOptions` 接受
`flightProtocol.RawMetadata`、取消信号以及 header 和 trailer 回调，但不会
应用高级外观层的截止时间规范化或客户端关闭检查。`FlightServiceDefinition`
仍可与兼容的直接 `nice-grpc` 依赖配合，用于自定义客户端构建。

## 底层 API 迁移

原来从 `arrow-flight-client/raw` 进行的命名导入应迁移到根命名空间：

```ts
import { flightProtocol } from 'arrow-flight-client';

const message = flightProtocol.FlightData.create({ dataHeader, dataBody });
type RawClient = flightProtocol.FlightRawClient;
```

生成的嵌套名称使用经过筛选的别名：

- `FlightDescriptor_DescriptorType` 改为
  `flightProtocol.FlightDescriptorType`；
- `CloseSessionResult_Status` 改为 `flightProtocol.CloseSessionStatus`；
- `SessionOptionValue_StringListValue` 改为
  `flightProtocol.SessionOptionStringListValue`；
- `SetSessionOptionsResult_Error` 改为
  `flightProtocol.SetSessionOptionsError`；
- `SetSessionOptionsResult_ErrorValue` 改为
  `flightProtocol.SetSessionOptionsErrorValue`。

原来的 `FlightGrpcClient` 别名和生成的 `FlightServiceClient` 类型均改为
`flightProtocol.FlightRawClient`。
`flightProtocol.FlightProtocolInput<T>` 表示该客户端及经过筛选的编解码器所
接受的递归请求结构。生成器辅助函数和服务器实现类型没有公共替代项。

`apache-arrow@^21.1.0` 是必需的对等依赖。应用程序和客户端必须解析到同一个
运行时实例，因为 Arrow 表、记录批次、数据模式和 IPC 写入器依赖运行时类
标识。来自第二个物理副本或不受支持主版本的值不属于兼容的公共输入。

## 流式模型

Flight 响应流仍为 `AsyncIterable` 值。`listFlights()`、`doPut()`、
`doAction()` 和 `listActions()` 不会收集响应。`doGet()` 返回只能消费一次的
`FlightStreamReader`，以保持记录批次与其应用元数据之间的关联，并避免丢弃
仅包含元数据的消息。

结果收集必须显式进行：`getTable()` 创建完整的 Arrow `Table`，而
`putTable()` 收集服务器返回的所有 `PutResult` 消息。

## IPC 所有权

客户端负责在 Flight 帧与 Arrow IPC 之间进行转换：

- 每个 `FlightData.dataHeader` 包含一个原始 Arrow IPC `Message`
  flatbuffer；
- `FlightData.dataBody` 仅包含对应的 Arrow 数据体缓冲区；
- `DoPut` 描述符只附加到第一条消息；
- 客户端应用元数据在 `DoPut` 数据模式之后立即作为独立的纯元数据消息发送，
  因此即使没有后续数据，服务器读取器也可以观察到该元数据；
- `DoGet` 流会在 Arrow JS 读取数据模式、字典消息和记录批次之前恢复封装的 IPC
  帧；
- 数据进入 Arrow 读取器前会验证数据体长度。

通过包根目录提供的高级 API 调用时，调用方不应构造这些字段。IPC 适配器会保留
调用方提供的批次边界，并且不会自动拆分过大的 `RecordBatch`。

## 生命周期与调用

`FlightClient` 拥有一个 gRPC 通道。`close()` 是幂等的，客户端关闭后发起的
高级调用会被拒绝。客户端元数据应用于每次调用；单次调用的元数据会替换同名
配置值，空值数组则会在该次调用中删除对应的已配置键。高级调用支持
`AbortSignal` 和绝对 `Date` 截止时间。调用方取消时以 `AbortError` 拒绝；
高级调用截止时间到期时则以 `nice-grpc` 的 `ClientError` 拒绝，其错误码为
`DEADLINE_EXCEEDED`。

TLS 默认使用平台根证书，也支持自定义根证书和可选的双向 TLS 客户端身份。
私钥和证书链共同构成一个客户端身份，必须同时配置。

`maxReceiveMessageLength` 和 `maxSendMessageLength` 以字节为单位配置对应的
gRPC 消息限制。限制应用于每条序列化后的 `FlightData` 消息，而不是完整数据
流，因此较大的逻辑负载应拆分为多个有界记录批次，并为传输外层消息预留空间。

## 当前范围

高级 API 覆盖发现、`GetFlightInfo`、`PollFlightInfo`、`GetSchema`、`DoGet`、
`DoPut` 和操作。`Handshake` 和 `DoExchange` 需要通过 `FlightClient.raw`
调用；底层 `DoExchange` 的调用方还需要自行处理 Arrow IPC 帧。尚未实现基于
endpoint location 的自动路由。传输失败仍表现为 `nice-grpc` 错误；高级调用
的截止时间到期会明确报告 `DEADLINE_EXCEEDED` 状态。
