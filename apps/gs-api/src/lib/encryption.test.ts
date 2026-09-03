import assert from 'node:assert/strict';
import test from 'node:test';
import { getMasterKey } from './encryption';

test('imports a 32-byte AES key from an openssl rand -hex 32 secret', async () => {
  const key = await getMasterKey({ INTEGRATION_MASTER_KEY: 'ab'.repeat(32) });
  assert.equal(key.algorithm.name, 'AES-GCM');
  assert.equal(key.usages.includes('encrypt'), true);
  assert.equal(key.usages.includes('decrypt'), true);
});

test('rejects secret values that do not encode a 32-byte AES key', async () => {
  await assert.rejects(
    getMasterKey({ INTEGRATION_MASTER_KEY: 'too-short' }),
    /Failed to load encryption master key/,
  );
});
