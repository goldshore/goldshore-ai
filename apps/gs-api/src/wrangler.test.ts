import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), '../wrangler.toml');
const wranglerConfig = readFileSync(fixturePath, 'utf8');

const getEnvBlock = (envName: 'prod' | 'production') => {
  const start = wranglerConfig.indexOf(`[env.${envName}]`);
  assert.notStrictEqual(start, -1, `Expected [env.${envName}] block to exist`);

  const nextEnvName = envName === 'prod' ? 'production' : 'preview';
  const nextEnvStart = wranglerConfig.indexOf(`\n[env.${nextEnvName}]`, start + 1);

  return nextEnvStart === -1
    ? wranglerConfig.slice(start)
    : wranglerConfig.slice(start, nextEnvStart);
};

describe('wrangler environment bindings', () => {
  it('keeps the KV binding name expected by API handlers in deployed envs', () => {
    for (const envName of ['prod', 'production']) {
      const block = getEnvBlock(envName);
      assert.match(block, /\[\[env\.(?:prod|production)\.kv_namespaces\]\][\s\S]*?binding = "KV"/);
      assert.doesNotMatch(block, /binding = "GS_CONFIG"/);
      assert.doesNotMatch(block, /binding = "GS_API_DATA"/);
    }
  });

  it('includes KV, D1, R2, and AI bindings in deployed envs', () => {
    for (const envName of ['prod', 'production']) {
      const block = getEnvBlock(envName);
      assert.match(block, new RegExp(`\\[\\[env\\.${envName}\\.kv_namespaces\\]\\][\\s\\S]*?binding = "KV"`));
      assert.match(block, new RegExp(`\\[\\[env\\.${envName}\\.kv_namespaces\\]\\][\\s\\S]*?binding = "CONTROL_LOGS"`));
      assert.match(block, new RegExp(`\\[\\[env\\.${envName}\\.r2_buckets\\]\\][\\s\\S]*?binding = "ASSETS"`));
      assert.match(block, new RegExp(`\\[\\[env\\.${envName}\\.d1_databases\\]\\][\\s\\S]*?binding = "DB"`));
      assert.match(block, new RegExp(`\\[env\\.${envName}\\.ai\\][\\s\\S]*?binding = "AI"`));
    }
  });
});
