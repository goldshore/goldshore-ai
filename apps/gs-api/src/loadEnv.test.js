import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { _test, loadGatewayEnv } from './loadEnv.js';

test('parseEnvLine handles blank/comment/invalid lines', () => {
  assert.equal(_test.parseEnvLine(''), null);
  assert.equal(_test.parseEnvLine('   # comment'), null);
  assert.equal(_test.parseEnvLine('INVALID'), null);
});

test('parseEnvLine handles plain and export syntax', () => {
  assert.deepEqual(_test.parseEnvLine('CF_GATEWAY_URL=https://example.com'), {
    key: 'CF_GATEWAY_URL',
    value: 'https://example.com',
  });

  assert.deepEqual(_test.parseEnvLine("export CF_AIG_TOKEN='abc123'"), {
    key: 'CF_AIG_TOKEN',
    value: 'abc123',
  });
});

test('loadGatewayEnv populates missing values and preserves existing ones', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-env-'));

  fs.writeFileSync(
    path.join(tmpDir, '.env'),
    [
      'CF_GATEWAY_URL=https://gateway.example/compat',
      'CF_AIG_TOKEN=from-dot-env',
      '',
    ].join('\n'),
  );

  fs.writeFileSync(path.join(tmpDir, '.dev.vars'), 'CF_AIG_TOKEN=from-dev-vars\n');

  const previousToken = process.env.CF_AIG_TOKEN;
  const previousUrl = process.env.CF_GATEWAY_URL;

  process.env.CF_AIG_TOKEN = 'already-set';
  delete process.env.CF_GATEWAY_URL;

  try {
    loadGatewayEnv({ cwd: tmpDir });
    assert.equal(process.env.CF_AIG_TOKEN, 'already-set');
    assert.equal(process.env.CF_GATEWAY_URL, 'https://gateway.example/compat');
  } finally {
    if (previousToken === undefined) {
      delete process.env.CF_AIG_TOKEN;
    } else {
      process.env.CF_AIG_TOKEN = previousToken;
    }

    if (previousUrl === undefined) {
      delete process.env.CF_GATEWAY_URL;
    } else {
      process.env.CF_GATEWAY_URL = previousUrl;
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
