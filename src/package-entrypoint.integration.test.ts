/**
 * Package entrypoint integration tests protect installed-package wiring.
 *
 * Allowed here:
 * - resolving the root entrypoint through the package manifest;
 * - checking that runtime and declaration targets exist;
 * - enforcing the root-only package export map.
 *
 * This file must not repeat source facade assertions from index.test.ts.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';

interface PackageManifest {
  readonly main?: unknown
  readonly types?: unknown
  readonly exports?: unknown
}

const packageRoot = resolve(__dirname, '..');
const requireFromPackage = createRequire(__filename);
const manifest = JSON.parse(
  readFileSync(resolve(packageRoot, 'package.json'), 'utf8')
) as PackageManifest;

describe('package entrypoint integration', () => {
  test('loads the package root from the compiled runtime entrypoint', () => {
    const runtimeEntrypoint = resolve(packageRoot, 'dist/index.js');

    assert.strictEqual(
      requireFromPackage.resolve('arrow-flight-client'),
      runtimeEntrypoint
    );
    assert.doesNotThrow(() => requireFromPackage('arrow-flight-client'));
  });

  test('keeps runtime and declaration manifest targets aligned', () => {
    assert.strictEqual(manifest.main, 'dist/index.js');
    assert.strictEqual(manifest.types, 'dist/index.d.ts');
    assert.deepStrictEqual(manifest.exports, { '.': './dist/index.js' });
    assert.strictEqual(existsSync(resolve(packageRoot, 'dist/index.js')), true);
    assert.strictEqual(existsSync(resolve(packageRoot, 'dist/index.d.ts')), true);
  });

  test('does not expose implementation subpaths', () => {
    assert.throws(
      () => requireFromPackage.resolve(
        'arrow-flight-client/dist/client/flight-client'
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.strictEqual(
          'code' in error ? error.code : undefined,
          'ERR_PACKAGE_PATH_NOT_EXPORTED'
        );
        return true;
      }
    );
  });
});
