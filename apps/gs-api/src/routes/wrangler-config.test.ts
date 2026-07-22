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
        new RegExp(
          `\\[\\[env\\.${envName}\\.r2_buckets\\]\\][\\s\\S]*?binding = "RISK_RADAR_R2"`,
        ),
      );
      assert.match(
        wranglerToml,
        new RegExp(
          `\\[\\[env\\.${envName}\\.d1_databases\\]\\][\\s\\S]*?binding = "PLATFORM_DB"`,
        ),
      );
      assert.match(
        wranglerToml,
        new RegExp(
          `\\[\\[env\\.${envName}\\.d1_databases\\]\\][\\s\\S]*?binding = "RISK_RADAR_DB"`,
        ),
      );
      assert.match(
        wranglerToml,
        new RegExp(`\\[env\\.${envName}\\.ai\\][\\s\\S]*?binding = "AI"`),
      );
    });
  }

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
    assert.match(
      topLevel,
      /\[\[r2_buckets\]\][\s\S]*?binding\s*=\s*"GS_ASSETS"/,
    );
    assert.match(topLevel, /\[ai\][\s\S]*?binding\s*=\s*"AI"/);
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

  it('keeps web and migrated admin hosts separate from API hosts', () => {
    assert.deepEqual(routePatterns(environmentBlock(webWranglerToml, 'prod')), [
      'goldshore.ai/*',
      'goldshore.org/*',
      'admin.goldshore.ai/*',
      'admin.goldshore.org/*',
    ]);
  });
});
