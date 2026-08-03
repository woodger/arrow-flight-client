# 身份验证指南

[English](../../guides/authentication.md) | [Русский](../../ru/guides/authentication.md) | 简体中文

本指南包含为监听 `localhost:8815` 的 Flight 服务器配置身份验证的代码片段。
有关发现、下载、流式处理和上传的示例，请参阅
[主要使用指南](./index.md)。

## Bearer Token

配置的元数据会随每次高级客户端调用一起发送：

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

## 双向 TLS

服务器要求双向 TLS 时，请提供受信任的根证书和客户端身份：

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

证书路径相对于进程当前工作目录解析。私钥和证书链共同构成一个客户端身份，
必须同时配置。
