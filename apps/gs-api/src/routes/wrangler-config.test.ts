import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const wranglerToml = readFileSync(resolve(import.meta.dirname, '../../wrangler.toml'), 'utf8');

describe('gs-api wrangler env bindings', () => {
  // Canonical environments are [env.prod] and [env.preview].
  // Legacy [env.production] has been intentionally removed.
  for (const envName of ['prod', 'preview']) {
    it(`keeps the KV binding required by runtime handlers in ${envName}`, () => {
      assert.match(
        wranglerToml,
        new RegExp(`\\[\\[env\\.${envName}\\.kv_namespaces\\]\\][\\s\\S]*?binding = "KV"[\\s\\S]*?id = "`)
      );
    });

    it(`defines PLATFORM_DB, GS_ASSETS, and AI bindings for ${envName}`, () => {
      assert.match(
        wranglerToml,
        new RegExp(`\\[\\[env\\.${envName}\\.r2_buckets\\]\\][\\s\\S]*?binding = "GS_ASSETS"`)
      );
      assert.match(
        wranglerToml,
        new RegExp(`\\[\\[env\\.${envName}\\.d1_databases\\]\\][\\s\\S]*?binding = "PLATFORM_DB"`)
      );
      assert.match(
        wranglerToml,
        new RegExp(`\\[env\\.${envName}\\.ai\\][\\s\\S]*?binding = "AI"`)
      );
    });
  }
});
