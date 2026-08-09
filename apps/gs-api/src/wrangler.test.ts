import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), '../wrangler.toml');
const wranglerConfig = readFileSync(fixturePath, 'utf8');

const getEnvBlock = (envName: 'prod' | 'preview') => {
  const start = wranglerConfig.indexOf(`[env.${envName}]`);
  assert.notStrictEqual(start, -1, `Expected [env.${envName}] block to exist`);

  const nextEnvName = envName === 'prod' ? 'preview' : 'migrations';
  const nextEnvStart = wranglerConfig.indexOf(`\n[env.${nextEnvName}]`, start + 1);

  return nextEnvStart === -1
    ? wranglerConfig.slice(start)
    : wranglerConfig.slice(start, nextEnvStart);
};

describe('wrangler environment bindings', () => {
  it('keeps production aliases together and preview routes isolated', () => {
    const prod = getEnvBlock('prod');
    const preview = getEnvBlock('preview');
    assert.match(prod, /api\.goldshore\.ai\/\*/);
    assert.match(prod, /api\.goldshore\.org\/\*/);
    assert.match(preview, /api-preview\.goldshore\.ai\/\*/);
    assert.doesNotMatch(preview, /(?:agent|mail|ops|trading|dashboard|dash)\.goldshore\.ai\/\*/);
    assert.doesNotMatch(preview, /goldshore\.org/);
  });

  it('keeps the KV binding name expected by API handlers in deployed envs', () => {
    for (const envName of ['prod', 'preview']) {
      const block = getEnvBlock(envName);
      assert.match(block, /\[\[env\.(?:prod|preview)\.kv_namespaces\]\][\s\S]*?binding = "KV"/);
      assert.doesNotMatch(block, /binding = "GS_CONFIG"/);
      assert.doesNotMatch(block, /binding = "GS_API_DATA"/);
    }
  });

  it('includes KV, D1, R2, and AI bindings in deployed envs', () => {
    for (const envName of ['prod', 'preview']) {
      const block = getEnvBlock(envName);
      assert.match(block, new RegExp(`\\[\\[env\\.${envName}\\.kv_namespaces\\]\\][\\s\\S]*?binding = "KV"`));
      assert.match(block, new RegExp(`\\[\\[env\\.${envName}\\.kv_namespaces\\]\\][\\s\\S]*?binding = "CONTROL_LOGS"`));
      assert.match(block, new RegExp(`\\[\\[env\\.${envName}\\.r2_buckets\\]\\][\\s\\S]*?binding = "GS_ASSETS"`));
      assert.match(block, new RegExp(`\\[\\[env\\.${envName}\\.d1_databases\\]\\][\\s\\S]*?binding = "PLATFORM_DB"`));
      assert.match(block, new RegExp(`\\[env\\.${envName}\\.ai\\][\\s\\S]*?binding = "AI"`));
    }
  });
});

  it('declares each binding once per named environment and has no ghost production environment', () => {
    assert.doesNotMatch(wranglerConfig, /env\.production/);
    assert.doesNotMatch(wranglerConfig, /^\[\[(?:kv_namespaces|r2_buckets|d1_databases|queues\.)/m);

    for (const envName of ['prod', 'preview'] as const) {
      const block = getEnvBlock(envName);
      const bindings = [...block.matchAll(/^binding = "([A-Z0-9_]+)"$/gm)].map((match) => match[1]);
      assert.deepEqual(bindings, [...new Set(bindings)], `${envName} contains duplicate binding names`);
    }
  });

  it('keeps preview isolated from production routes and mutating production queues', () => {
    const preview = getEnvBlock('preview');
    assert.match(preview, /STATE_MUTATIONS_ENABLED = "false"/);
    assert.match(preview, /api-preview\.goldshore\.ai/);
    assert.doesNotMatch(preview, /(?:agent|mail|ops|trading|dashboard|dash)\.goldshore\.ai/);
    assert.doesNotMatch(preview, /\[\[env\.preview\.queues\.(?:producers|consumers)\]\]/);
  });
