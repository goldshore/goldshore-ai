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


describe('wrangler Cloudflare Access audience configuration', () => {
  it('documents and binds the prod Access AUD tag for protected gateway routes', () => {
    const prodVars = wranglerToml.match(/\[env\.prod\.vars\]([\s\S]*?)(?:\n\[|$)/)?.[1] ?? '';

    assert.match(prodVars, /CLOUDFLARE_ACCESS_AUDIENCE\s*=\s*"[a-f0-9]{64}"/);
    assert.match(prodVars, /Protected-route AUD tag shared by gw\.goldshore\.ai, api\.goldshore\.ai, and agent\.goldshore\.ai\./);
    assert.match(prodVars, /Keep those hostnames in one Access application/);
  });
});
