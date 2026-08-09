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

const bindingBlocks = (
  toml: string,
  environment: string,
  table: string,
  binding: string,
) =>
  [
    ...toml.matchAll(
      new RegExp(
        `\\[\\[env\\.${environment}\\.${table}\\]\\][\\s\\S]*?(?=\\r?\\n\\[|$)`,
        'g',
      ),
    ),
  ]
    .map((match) => match[0])
    .filter((block) =>
      new RegExp(`^binding\\s*=\\s*"${binding}"$`, 'm').test(block),
    );

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
      assert.equal(
        bindingBlocks(
          wranglerToml,
          envName,
          'kv_namespaces',
          'RISK_RADAR_CACHE',
        ).length,
        1,
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
      assert.equal(
        bindingBlocks(
          wranglerToml,
          envName,
          'd1_databases',
          'RISK_RADAR_DB',
        ).length,
        1,
      );
      assert.match(
        wranglerToml,
        new RegExp(`\\[env\\.${envName}\\.ai\\][\\s\\S]*?binding = "AI"`)
      );
    });
  }

  it('uses only verified Risk Radar resources in prod and preview', () => {
    for (const envName of ['prod', 'preview']) {
      assert.match(
        bindingBlocks(
          wranglerToml,
          envName,
          'kv_namespaces',
          'RISK_RADAR_CACHE',
        )[0],
        /id\s*=\s*"0b56873b6d7b451f9279481920a15447"/,
      );
      assert.match(
        bindingBlocks(
          wranglerToml,
          envName,
          'd1_databases',
          'RISK_RADAR_DB',
        )[0],
        /database_name\s*=\s*"risk-radar-db"[\s\S]*?database_id\s*=\s*"b0bf3b0e-a7d0-49ae-ac82-4f19450b2ce2"/,
      );
    }

    assert.doesNotMatch(wranglerToml, /\[\[env\.production\./);
    assert.doesNotMatch(
      wranglerToml,
      /0e67c3fe3d2b3231e7d4dba704e7dcd6|a2315c0e83f27b610c3dfdd30eb0a9ea|aabedb82-60ca-5697-bbd5-9e85675ee7c5|fe25ba0b-7d1e-5362-a03f-065487222a08/,
    );
  });

  it('keeps top-level bindings safe for Cloudflare Workers Builds version uploads', () => {
    const topLevel = topLevelBlock(wranglerToml);

    assert.match(topLevel, /\[vars\][\s\S]*?ENV\s*=\s*"production"/);
    assert.match(
      topLevel,
      /\[vars\][\s\S]*?CLOUDFLARE_ACCESS_AUDIENCE\s*=\s*"8510d42c31fc791e295427031ffeef7c7ebc0f1b62d8634fbb284bf82562f528"/,
    );
    assert.match(
      topLevel,
      /\[\[kv_namespaces\]\][\s\S]*?binding\s*=\s*"KV"[\s\S]*?id\s*=\s*"e0b8b807191346c3b0afc25fe716d2cd"/,
    );
    assert.match(
      topLevel,
      /\[\[d1_databases\]\][\s\S]*?binding\s*=\s*"PLATFORM_DB"/,
    );
    assert.doesNotMatch(topLevel, /\[\[d1_databases\]\][\s\S]*?binding\s*=\s*"DB"/);
    assert.doesNotMatch(topLevel, /database_id\s*=\s*"gs_db_001"/);
    assert.match(
      topLevel,
      /\[\[r2_buckets\]\][\s\S]*?binding\s*=\s*"GS_ASSETS"/,
    );
    assert.match(topLevel, /\[ai\][\s\S]*?binding\s*=\s*"AI"/);
    assert.doesNotMatch(
      wranglerToml,
      /\[\[env\.(prod|preview)\.secrets_store_secrets\]\][\s\S]*?binding\s*=\s*"INTEGRATION_MASTER_KEY"/,
    );
    assert.doesNotMatch(wranglerToml, /\[\[migrations\]\]/);
    assert.doesNotMatch(wranglerToml, /\[\[env\.(prod|preview)\.migrations\]\]/);
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
