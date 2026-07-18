import { once } from 'node:events';
import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { tableFromArrays } from 'apache-arrow';
import { FlightClient, pathDescriptor } from '../index';

interface RunningServer {
  readonly address: string
  readonly process: ChildProcessWithoutNullStreams
}

interface UploadSummary {
  readonly batchCount: number
  readonly rowCount: number
  readonly metadata: readonly string[]
  readonly events: readonly string[]
}

describe('FlightClient PyArrow compatibility', () => {
  let server: RunningServer | undefined;

  before(async () => {
    server = await startServer();
  });

  after(async () => {
    if (server) {
      await stopServer(server.process);
    }
  });

  test('sends configured client metadata', async () => {
    assert.ok(server);
    const client = new FlightClient(server.address, {
      metadata: { authorization: 'Bearer configured' }
    });

    try {
      const results = [];

      for await (const result of client.doAction({
        type: 'read-authorization'
      })) {
        results.push(Buffer.from(result.body).toString());
      }

      assert.deepStrictEqual(results, ['Bearer configured']);
    }
    finally {
      await client.close();
    }
  });

  test('downloads a RecordBatch larger than four MiB', async () => {
    assert.ok(server);
    const client = new FlightClient(server.address, {
      maxReceiveMessageLength: 8 * 1024 * 1024
    });

    try {
      const table = await client.getTable(Buffer.from('large-record-batch'));

      assert.strictEqual(table.numRows, 700_000);
      assert.strictEqual(table.getChild('value')?.get(0), 1.25);
      assert.strictEqual(table.getChild('value')?.get(699_999), 1.25);
    }
    finally {
      await client.close();
    }
  });

  test('delivers application metadata for an empty upload', async () => {
    assert.ok(server);
    const client = new FlightClient(server.address);
    const schema = tableFromArrays({
      value: new Float64Array(0)
    }).schema;
    const results = [];

    try {
      for await (const result of client.doPut(
        pathDescriptor('empty-metadata'),
        [],
        {
          schema,
          appMetadata: Buffer.from('manifest-1')
        }
      )) {
        results.push(result);
      }

      assert.strictEqual(results.length, 1);
      const summary = JSON.parse(
        Buffer.from(results[0]?.appMetadata ?? []).toString()
      ) as UploadSummary;

      assert.deepStrictEqual(summary, {
        batchCount: 0,
        rowCount: 0,
        metadata: ['manifest-1'],
        events: ['metadata']
      });
    }
    finally {
      await client.close();
    }
  });

  test('uploads a large logical payload as bounded RecordBatches', async () => {
    assert.ok(server);
    const client = new FlightClient(server.address, {
      maxSendMessageLength: 2 * 1024 * 1024
    });
    const table = tableFromArrays({
      value: new Float64Array(128 * 1024).fill(1.25)
    });
    const batch = table.batches[0];
    assert.ok(batch);
    const results = [];

    try {
      for await (const result of client.doPut(
        pathDescriptor('bounded-batches'),
        [batch, batch, batch, batch, batch]
      )) {
        results.push(result);
      }

      assert.strictEqual(results.length, 1);
      const summary = JSON.parse(
        Buffer.from(results[0]?.appMetadata ?? []).toString()
      ) as UploadSummary;

      assert.deepStrictEqual(summary, {
        batchCount: 5,
        rowCount: 5 * 128 * 1024,
        metadata: [],
        events: ['batch', 'batch', 'batch', 'batch', 'batch']
      });
    }
    finally {
      await client.close();
    }
  });
});

async function startServer(): Promise<RunningServer> {
  const fixture = resolve(
    __dirname,
    '../../test/pyarrow/flight_server.py'
  );
  const python = process.env['PYTHON'] ?? 'python3';
  const child = spawn(python, [fixture]);
  child.stdin.end();
  let stderr = '';

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });

  try {
    const port = await waitForPort(child, () => stderr);
    return { address: `127.0.0.1:${port}`, process: child };
  }
  catch (error) {
    child.kill();
    throw error;
  }
}

function waitForPort(
  child: ChildProcessWithoutNullStreams,
  getStderr: () => string
): Promise<number> {
  return new Promise((resolvePort, rejectPort) => {
    const lines = createInterface({ input: child.stdout });
    const timeout = setTimeout(() => {
      finish(new Error(`PyArrow server startup timed out\n${getStderr()}`));
    }, 15_000);

    const onError = (error: Error) => finish(error);
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      finish(new Error(
        `PyArrow server exited before startup: ${code ?? signal}\n${getStderr()}`
      ));
    };

    const finish = (error: Error | undefined, port?: number) => {
      clearTimeout(timeout);
      child.removeListener('error', onError);
      child.removeListener('exit', onExit);
      lines.close();

      if (error) {
        rejectPort(error);
      }
      else if (port !== undefined) {
        resolvePort(port);
      }
    };

    child.once('error', onError);
    child.once('exit', onExit);
    lines.once('line', (line) => {
      try {
        const ready = JSON.parse(line) as { readonly port?: unknown };

        if (typeof ready.port !== 'number' || ready.port <= 0) {
          throw new Error(`Invalid PyArrow server port: ${line}`);
        }

        finish(undefined, ready.port);
      }
      catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}

async function stopServer(
  child: ChildProcessWithoutNullStreams
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const force = setTimeout(() => child.kill('SIGKILL'), 5_000);

  try {
    await exited;
  }
  finally {
    clearTimeout(force);
  }
}
