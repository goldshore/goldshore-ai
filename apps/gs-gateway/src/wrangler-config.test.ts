import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const wranglerToml = readFileSync(resolve(import.meta.dirname, '../wrangler.toml'), 'utf8');

describe('wrangler d1 bindings', () => {
  it('defines PLATFORM_DB for prod', () => {
    assert.match(wranglerToml, /\[\[env\.prod\.d1_databases\]\][\s\S]*?binding = "PLATFORM_DB"/);
  });
});
