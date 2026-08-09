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
  it('documents the prod Access AUD tag requirement for protected gateway routes', () => {
    const prodVars = wranglerToml.match(/\[env\.prod\.vars\]([\s\S]*?)(?:\n\[|$)/)?.[1] ?? '';

    assert.match(prodVars, /CLOUDFLARE_TEAM_DOMAIN\s*=\s*"goldshore\.cloudflareaccess\.com"/);
    assert.match(prodVars, /Set CLOUDFLARE_ACCESS_AUDIENCE as a Worker secret in Cloudflare\./);
    assert.match(prodVars, /The live AUD tag must match the Goldshore Gateway Access application\./);
  });

  it('owns the gateway routes in prod', () => {
    const prodBlock = wranglerToml.match(/\[env\.prod\]([\s\S]*?)(?:\n\[env\.|$)/)?.[1] ?? '';

    assert.match(prodBlock, /gw\.goldshore\.ai\/\*/);
    assert.match(prodBlock, /agent\.goldshore\.ai\/\*/);
  });
});
