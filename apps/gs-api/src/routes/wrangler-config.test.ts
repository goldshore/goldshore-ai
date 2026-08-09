import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const wranglerToml = readFileSync(
  resolve(import.meta.dirname, '../../wrangler.toml'),
  'utf8',
);
const webWranglerToml = readFileSync(
  resolve(import.meta.dirname, '../../../gs-web/wrangler.toml'),
  'utf8',
);

const environmentBlock = (toml: string, environment: string) => {
  const match = toml.match(
    new RegExp(
      `\\[env\\.${environment}\\]([\\s\\S]*?)(?=\\n\\[env\\.${environment}\\.|\\n\\[env\\.|$)`,
    ),
  );
  assert.ok(match, `missing [env.${environment}] block`);
  return match[1];
};

const topLevelBlock = (toml: string) => toml.split(/\r?\n\[env\.prod\]/)[0];

const routePatterns = (block: string) =>
  [...block.matchAll(/pattern\s*=\s*"([^"]+)"/g)].map((match) => match[1]);

const queueConsumerNames = (block: string) =>
  [
    ...block.matchAll(
      /\[\[env\.[^.]+\.queues\.consumers\]\][\s\S]*?queue\s*=\s*"([^"]+)"/g,
    ),
  ].map((match) => match[1]);

describe('gs-api wrangler env bindings', () => {
  // Canonical environments are [env.prod] and [env.preview].
  // Legacy [env.production] has been intentionally removed.
  for (const envName of ['prod', 'preview']) {
    it(`keeps the KV binding required by runtime handlers in ${envName}`, () => {
      assert.match(
        wranglerToml,
        new RegExp(
          `\\[\\[env\\.${envName}\\.kv_namespaces\\]\\][\\s\\S]*?binding = "KV"[\\s\\S]*?id = "`,
        ),
      );
      assert.match(
        wranglerToml,
        new RegExp(
          `\\[\\[env\\.${envName}\\.kv_namespaces\\]\\][\\s\\S]*?binding = "RISK_RADAR_CACHE"[\\s\\S]*?id = "`,
        ),
      );
      assert.match(
        wranglerToml,
        new RegExp(`\\[\\[env\\.${envName}\\.kv_namespaces\\]\\][\\s\\S]*?binding = "RISK_RADAR_CACHE"[\\s\\S]*?id = "`)
      );
    });

    it(`defines platform, Risk Radar, and AI bindings for ${envName}`, () => {
      assert.match(
        wranglerToml,
        new RegExp(
          `\\[\\[env\\.${envName}\\.r2_buckets\\]\\][\\s\\S]*?binding = "GS_ASSETS"`,
        ),
      );
      assert.match(
        wranglerToml,
        new RegExp(`\\[\\[env\\.${envName}\\.r2_buckets\\]\\][\\s\\S]*?binding = "RISK_RADAR_R2"`)
      );
      assert.match(
        wranglerToml,
        new RegExp(`\\[\\[env\\.${envName}\\.d1_databases\\]\\][\\s\\S]*?binding = "PLATFORM_DB"`)
      );
      assert.match(
        wranglerToml,
        new RegExp(`\\[\\[env\\.${envName}\\.d1_databases\\]\\][\\s\\S]*?binding = "RISK_RADAR_DB"`)
      );
      assert.match(
        wranglerToml,
        new RegExp(`\\[env\\.${envName}\\.ai\\][\\s\\S]*?binding = "AI"`)
      );
    });
  }

  it('keeps all resources scoped to canonical named environments', () => {
    const topLevel = topLevelBlock(wranglerToml);

    assert.doesNotMatch(wranglerToml, /env\.production/);
    assert.doesNotMatch(topLevel, /^\[vars\]/m);
    assert.doesNotMatch(topLevel, /^\[\[(?:kv_namespaces|d1_databases|r2_buckets|queues\.)/m);
    assert.doesNotMatch(topLevel, /^\[ai\]/m);
    assert.doesNotMatch(wranglerToml, /database_id\s*=\s*"gs_db_001"/);

    for (const envName of ['prod', 'preview']) {
      const start = wranglerToml.indexOf(`[env.${envName}]`);
      const end = envName === 'prod' ? wranglerToml.indexOf('[env.preview]') : wranglerToml.length;
      const block = wranglerToml.slice(start, end);
      const bindings = [...block.matchAll(/^binding = "([A-Z0-9_]+)"$/gm)].map((match) => match[1]);
      assert.equal(bindings.length, new Set(bindings).size, `${envName} has duplicate bindings`);
    }
  });

  it('keeps preview fail-closed and preview-only routes', () => {
    const preview = wranglerToml.slice(wranglerToml.indexOf('[env.preview]'));
    assert.match(preview, /STATE_MUTATIONS_ENABLED = "false"/);
    assert.deepEqual(routePatterns(environmentBlock(wranglerToml, 'preview')), [
      'api-preview.goldshore.ai/*',
    ]);
    assert.doesNotMatch(preview, /\[\[env\.preview\.queues\.(?:producers|consumers)\]\]/);
  });

  it('routes consolidated backend hostnames to the canonical API Worker', () => {
    assert.deepEqual(routePatterns(environmentBlock(wranglerToml, 'prod')), [
      'api.goldshore.ai/*',
      'agent.goldshore.ai/*',
      'mail.goldshore.ai/*',
      'ops.goldshore.ai/*',
      'trading.goldshore.ai/*',
      'dashboard.goldshore.ai/*',
      'dash.goldshore.ai/*',
      'gw.goldshore.ai/*',
      'api.goldshore.org/*',
    ]);
  });

  it('keeps production gs-api queue ownership producer-only for externally consumed queues', () => {
    assert.deepEqual(
      queueConsumerNames(environmentBlock(wranglerToml, 'prod')),
      [],
    );
  });

  it('keeps web and admin hosts on the canonical gs-web Worker', () => {
    assert.deepEqual(routePatterns(environmentBlock(webWranglerToml, 'prod')), [
      'goldshore.ai/*',
      'goldshore.org/*',
      'admin.goldshore.ai/*',
      'admin-preview.goldshore.ai/*',
      'admin.goldshore.org/*',
      'risk.goldshore.ai/*',
      'risk.goldshore.org/*',
    ]);
  });

  it('keeps CONTROL_SYNC_TOKEN out of plain-text environment variables', () => {
    assert.doesNotMatch(wranglerToml, /^CONTROL_SYNC_TOKEN\s*=/m);
    assert.doesNotMatch(wranglerToml, /__PROD_CONTROL_SYNC_TOKEN__/);
  });
});
