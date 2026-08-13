#!/usr/bin/env node

/**
 * The compiled repository CLI dispatches contributor commands.
 *
 * Allowed here:
 * - resolving the fixed repository command paths;
 * - invoking pinned project-local development tools;
 * - preserving subprocess output, signals, and exit status.
 *
 * This file must not expose a consumer CLI or execute arbitrary shell input.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { constants as osConstants } from 'node:os';
import { resolve } from 'node:path';

const projectRoot = resolve(__dirname, '../..');
const requireFromCli = createRequire(__filename);
const usage = [
  'Usage:',
  '  node dist/cli/index.js generate proto',
  '  node dist/cli/index.js test pyarrow'
].join('\n');

async function runCli(args: readonly string[]): Promise<number> {
  const command = args.join(' ');

  switch (command) {
    case 'generate proto': {
      const protocScript = requireFromCli.resolve('grpc-tools/bin/protoc.js');
      const tsProtoPlugin = requireFromCli.resolve('ts-proto/protoc-gen-ts_proto');

      return runProcess(process.execPath, [
        protocScript,
        '--proto_path=contracts',
        `--plugin=protoc-gen-ts_proto=${tsProtoPlugin}`,
        '--ts_proto_out=src/generated',
        '--ts_proto_opt=outputServices=nice-grpc,outputServices=generic-definitions,useExactTypes=false,env=node,esModuleInterop=true',
        'contracts/Flight.proto'
      ]);
    }
    case 'test pyarrow':
      return runProcess(process.execPath, [
        '--test',
        'dist/client/flight-client.pyarrow.e2e.js'
      ]);
    default:
      process.stderr.write(`${usage}\n`);
      return 2;
  }
}

function runProcess(
  executable: string,
  args: readonly string[]
): Promise<number> {
  return new Promise((resolveExitCode, rejectProcess) => {
    const child = spawn(executable, args, {
      cwd: projectRoot,
      shell: false,
      stdio: 'inherit'
    });
    const signalHandlers = new Map<NodeJS.Signals, () => void>();
    const forwardedSignals: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

    for (const signal of forwardedSignals) {
      const forwardSignal = () => {
        child.kill(signal);
      };

      signalHandlers.set(signal, forwardSignal);
      process.once(signal, forwardSignal);
    }

    const removeSignalHandlers = () => {
      for (const [signal, handler] of signalHandlers) {
        process.removeListener(signal, handler);
      }
    };

    child.once('error', (error) => {
      removeSignalHandlers();
      rejectProcess(error);
    });
    child.once('close', (code, signal) => {
      removeSignalHandlers();
      resolveExitCode(signal === null ? code ?? 1 : signalExitCode(signal));
    });
  });
}

function signalExitCode(signal: NodeJS.Signals): number {
  const signalNumber = osConstants.signals[signal];

  return typeof signalNumber === 'number' ? 128 + signalNumber : 1;
}

async function main(): Promise<void> {
  try {
    process.exitCode = await runCli(process.argv.slice(2));
  }
  catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}

void main();
