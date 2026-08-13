#!/usr/bin/env node

/**
 * The repository CLI dispatches contributor commands without requiring a build.
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
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(cliPath), '../..');
const requireFromCli = createRequire(import.meta.url);
const usage = [
  'Usage:',
  '  node src/cli/index.mjs generate proto',
  '  node src/cli/index.mjs test pyarrow'
].join('\n');

/**
 * @param {readonly string[]} args
 * @returns {Promise<number>}
 */
async function runCli(args) {
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

/**
 * @param {string} executable
 * @param {readonly string[]} args
 * @returns {Promise<number>}
 */
function runProcess(executable, args) {
  return new Promise((resolveExitCode, rejectProcess) => {
    const child = spawn(executable, args, {
      cwd: projectRoot,
      shell: false,
      stdio: 'inherit'
    });
    /** @type {Map<NodeJS.Signals, () => void>} */
    const signalHandlers = new Map();

    /** @type {readonly NodeJS.Signals[]} */
    const forwardedSignals = ['SIGINT', 'SIGTERM'];

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

/**
 * @param {NodeJS.Signals} signal
 * @returns {number}
 */
function signalExitCode(signal) {
  const signalNumber = osConstants.signals[signal];

  return typeof signalNumber === 'number' ? 128 + signalNumber : 1;
}

async function main() {
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
