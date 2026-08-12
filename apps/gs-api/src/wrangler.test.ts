import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), '../wrangler.toml');
const wranglerConfig = readFileSync(fixturePath, 'utf8');
const prod = wranglerConfig.slice(wranglerConfig.indexOf('[env.prod]'));

describe('wrangler production baseline', () => {
  it('has one production environment and no dedicated preview resources', () => {
    assert.match(wranglerConfig, /^\[env\.prod\]$/m);
    assert.doesNotMatch(wranglerConfig, /\[env\.preview(?:\.|\])/);
    assert.doesNotMatch(wranglerConfig, /(?:gs-api|goldshore-jobs|gs-events|gs-mail-jobs|gs-assets)-preview/);
  });

  it('keeps canonical production bindings on gs-api', () => {
    for (const binding of ['KV', 'PLATFORM_DB', 'GS_ASSETS', 'MAIL_ARCHIVE', 'MAIL_JOBS_QUEUE', 'AI']) {
      assert.match(prod, new RegExp(`binding = "${binding}"`));
    }
    assert.match(prod, /\[\[env\.prod\.send_email\]\][\s\S]*?name = "EMAIL"/);
    assert.match(prod, /\[env\.prod\.observability\][\s\S]*?enabled = true/);
  });

  it('keeps production aliases on the unified API Worker', () => {
    for (const hostname of [
      'api.goldshore.ai', 'api.goldshore.org', 'agent.goldshore.ai', 'mail.goldshore.ai',
      'ops.goldshore.ai', 'trading.goldshore.ai', 'dashboard.goldshore.ai', 'gw.goldshore.ai',
    ]) {
      assert.match(prod, new RegExp(hostname.replace(/\./g, '\\.') + '/\\*'));
    }
  });
});
