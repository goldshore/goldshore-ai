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
    assert.deepEqual(queueConsumerNames(preview).sort(), [
      'goldshore-jobs-preview',
      'gs-events-preview',
      'gs-mail-jobs-preview',
    ]);
    assert.doesNotMatch(preview, /queue = "(?:goldshore-jobs|gs-events|gs-mail-jobs)"/);
  });

  it('routes consolidated backend hostnames to the canonical API Worker', () => {
    assert.deepEqual(routePatterns(environmentBlock(wranglerToml, 'prod')), [
      'api.goldshore.ai/*',
      'api.goldshore.org/*',
      'agent.goldshore.ai/*',
      'agent.goldshore.org/*',
      'mail.goldshore.ai/*',
      'mail.goldshore.org/*',
      'ops.goldshore.ai/*',
      'trading.goldshore.ai/*',
      'trading.goldshore.org/*',
      'dashboard.goldshore.ai/*',
      'dash.goldshore.ai/*',
      'gw.goldshore.ai/*',
    ]);
  });

  it('assigns the production queue consumers to gs-api', () => {
    // gs-api is the sole application consumer of the production queues after
    // the satellite migration.
    //
    const prod = wranglerToml.slice(
      wranglerToml.indexOf('[env.prod]'),
      wranglerToml.indexOf('[env.preview]'),
    );
    assert.deepEqual(queueConsumerNames(prod).sort(), [
      'goldshore-jobs',
      'gs-events',
      'gs-mail-jobs',
    ]);
    assert.match(wranglerToml, /dead_letter_queue = "gs-mail-dead-letter"/);
  });

  it('binds each environment to its isolated SignalsEvaluator workflow', () => {
    assert.match(
      wranglerToml,
      /\[\[env\.prod\.workflows\]\][\s\S]*?binding = "GS_SIGNALS"[\s\S]*?name = "gs-signals-evaluator"[\s\S]*?class_name = "SignalsEvaluator"/,
    );
    assert.match(
      wranglerToml,
      /\[\[env\.preview\.workflows\]\][\s\S]*?binding = "GS_SIGNALS"[\s\S]*?name = "gs-signals-evaluator-preview"[\s\S]*?class_name = "SignalsEvaluator"/,
    );
    assert.doesNotMatch(wranglerToml, /script_name = "gs-signals-prod"/);
  });

  it('keeps web and admin hosts on the canonical gs-web Worker', () => {
    assert.deepEqual(routePatterns(environmentBlock(webWranglerToml, 'prod')), [
      'goldshore.ai/*',
      'goldshore.org/*',
      'www.goldshore.ai/*',
      'www.goldshore.org/*',
      'admin.goldshore.ai/*',
      'admin.goldshore.org/*',
      'admin-preview.goldshore.ai/*',
      'risk.goldshore.ai/*',
      'risk.goldshore.org/*',
    ]);
  });

  it('keeps privileged backend resources out of the web Worker', () => {
    const prod = webWranglerToml.slice(
      webWranglerToml.indexOf('[env.prod]'),
      webWranglerToml.indexOf('[env.preview]'),
    );
    assert.match(
      topLevelBlock(webWranglerToml),
      /\[assets\][\s\S]*?binding = "ASSETS"/,
    );
    assert.doesNotMatch(
      prod,
      /^binding = "(?:API_AUTH|ARTIFACTS|BROWSER_RUN|CONTENT_WORKFLOW|CONTROL|D1_JOBS|GS_API|MAIL_JOBS)"$/m,
    );
    assert.doesNotMatch(
      prod,
      /\[\[env\.prod\.(?:durable_objects|r2_buckets|d1_databases|queues|services|workflows|send_email)/,
    );
  });

  it('keeps CONTROL_SYNC_TOKEN out of plain-text environment variables', () => {
    assert.doesNotMatch(wranglerToml, /^CONTROL_SYNC_TOKEN\s*=/m);
    assert.doesNotMatch(wranglerToml, /__PROD_CONTROL_SYNC_TOKEN__/);
  });

  it('keeps GoldClaw and Google Business OAuth redirects independent', () => {
    // Each variable is declared once per named environment. An earlier layout
    // also repeated the production values in a top-level [vars] block, so
    // these counts used to be 2; per-env declaration is what keeps preview
    // from silently inheriting a production callback URL.
    assert.equal(
      wranglerToml.match(
        /GOOGLE_OAUTH_REDIRECT_URI = "https:\/\/api\.goldshore\.ai\/goldclaw\/oauth\/google\/callback"/g,
      )?.length,
      1,
    );
    assert.equal(
      wranglerToml.match(
        /GOOGLE_BUSINESS_OAUTH_REDIRECT_URI = "https:\/\/api\.goldshore\.ai\/admin\/google\/oauth\/callback"/g,
      )?.length,
      1,
    );
    assert.match(
      wranglerToml,
      /GOOGLE_OAUTH_REDIRECT_URI = "https:\/\/api-preview\.goldshore\.ai\/goldclaw\/oauth\/google\/callback"/,
    );
    assert.match(
      wranglerToml,
      /GOOGLE_BUSINESS_OAUTH_REDIRECT_URI = "https:\/\/api-preview\.goldshore\.ai\/admin\/google\/oauth\/callback"/,
    );
    assert.doesNotMatch(
      wranglerToml,
      /^GOOGLE_OAUTH_REDIRECT_URI = ".*\/admin\/google\/oauth\/callback"/m,
    );
  });
});
