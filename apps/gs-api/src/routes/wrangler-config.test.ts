import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiConfig = readFileSync(resolve(import.meta.dirname, '../../wrangler.toml'), 'utf8');
const webConfig = readFileSync(resolve(import.meta.dirname, '../../../gs-web/wrangler.toml'), 'utf8');

const queueConsumers = (config: string) =>
  [...config.matchAll(/\[\[env\.prod\.queues\.consumers\]\][\s\S]*?queue\s*=\s*"([^"]+)"/g)]
    .map((match) => match[1]);

const productionRoutes = (config: string) => {
  const routes = config.match(/^routes = \[([\s\S]*?)^\]/m)?.[1] ?? '';
  return [...routes.matchAll(/pattern = "([^"]+)", zone_name = "([^"]+)"/g)]
    .map(([, pattern, zoneName]) => ({ pattern, zoneName }));
};

const d1Bindings = (config: string) =>
  [...config.matchAll(/\[\[env\.prod\.d1_databases\]\]\s*binding = "([^"]+)"/g)]
    .map((match) => match[1]);

describe('two-app Cloudflare binding contract', () => {
  it('assigns all production queue consumers and the signals Workflow to gs-api', () => {
    assert.deepEqual(queueConsumers(apiConfig).sort(), [
      'goldshore-jobs',
      'gs-events',
      'gs-mail-jobs',
    ]);
    assert.match(apiConfig, /dead_letter_queue = "gs-mail-dead-letter"/);
    assert.match(
      apiConfig,
      /\[\[env\.prod\.workflows\]\][\s\S]*?binding = "GS_SIGNALS"[\s\S]*?name = "gs-signals-evaluator"[\s\S]*?class_name = "SignalsEvaluator"/,
    );
    assert.ok(!d1Bindings(apiConfig).includes('GS_SIGNALS'));
  });

  it('reserves gs-api for API routes only; frontend/admin/operations routes go to gs-web', () => {
    assert.deepEqual(productionRoutes(apiConfig), [
      { pattern: 'api.goldshore.ai/*', zoneName: 'goldshore.ai' },
      { pattern: 'api.goldshore.org/*', zoneName: 'goldshore.org' },
    ]);

    // Admin, risk, and marketing routes are on gs-web. Legacy satellite
    // workers (agent, mail, ops, trading, dashboard, mcp) have been
    // consolidated into gs-api's event handlers or decommissioned.
    const webRoutes = productionRoutes(webConfig);
    assert.ok(webRoutes.some(r => r.pattern === 'admin.goldshore.ai/*'));
    assert.ok(webRoutes.some(r => r.pattern === 'admin.goldshore.org/*'));
    assert.ok(webRoutes.some(r => r.pattern === 'risk.goldshore.ai/*'));
    assert.ok(webRoutes.some(r => r.pattern === 'goldshore.ai/*'));
  });

  it('declares the cron consumed by the scheduled module handler', () => {
    assert.match(apiConfig, /\[env\.prod\.triggers\]\s*crons = \["0 2 \* \* \*"\]/);
  });

  it('keeps databases, object storage, queues, Workflows, and mail off gs-web', () => {
    assert.match(webConfig, /\[assets\][\s\S]*?binding = "ASSETS"/);

    // SESSION is deliberately absent from this list: gs-web binds a KV
    // namespace for Astro session/auth state. Everything transactional still
    // belongs to gs-api.
    // API is a service binding for internal RPC to gs-api, bypassing Cloudflare Access.
    assert.doesNotMatch(webConfig, /^binding = "(?:KV|PLATFORM_DB|GS_ASSETS|MAIL_JOBS_QUEUE|EMAIL)"$/m);
    assert.doesNotMatch(webConfig, /\[\[env\.prod\.(?:d1_databases|r2_buckets|queues|workflows|send_email)/);

    // gs-web's only permitted named runtime bindings are the session store and
    // the internal RPC service binding to gs-api.
    const webKvBindings = [...webConfig.matchAll(/^binding = "(\w+)"$/gm)]
      .map((m) => m[1])
      .filter((b) => b !== 'ASSETS' && b !== 'IMAGES');
    assert.deepEqual([...new Set(webKvBindings)], ['SESSION', 'API']);
    assert.match(webConfig, /\[\[env\.prod\.services\]\]\s*binding = "API"\s*service = "gs-api"/);
  });

  it('keeps gs-web free of a preview Worker environment', () => {
    // Only gs-api has one. gs-web previews are Worker Versions off the prod
    // manifest, so a [env.preview] here would create a second gs-web Worker.
    assert.doesNotMatch(webConfig, /^\s*\[env\.preview(?:\.|\])/m);
    assert.doesNotMatch(webConfig, /^\s*name\s*=\s*"gs-web-preview"/m);
    assert.doesNotMatch(webConfig, /^\s*pattern\s*=\s*"admin-preview\./m);
  });

  it('pins the gs-api preview environment to its own Worker and route', () => {
    assert.match(apiConfig, /^\s*\[env\.preview\]/m);
    assert.match(apiConfig, /^\s*name\s*=\s*"gs-api-preview"/m);
    assert.match(apiConfig, /pattern\s*=\s*"api-preview\.goldshore\.ai\/\*"/);
  });

  it('never points a gs-api preview binding at a production resource', () => {
    // The whole point of the preview environment is that a preview deploy
    // cannot touch live data. Compare the two blocks directly rather than
    // trusting the -preview suffix, which is a convention and not a guarantee.
    const block = (env) => {
      const start = apiConfig.indexOf(`[env.${env}]`);
      const rest = apiConfig.slice(start + 1);
      const nextEnv = rest.search(/\n\[env\.(?!\s*$)[a-z]+\]/);
      return nextEnv === -1 ? apiConfig.slice(start) : apiConfig.slice(start, start + 1 + nextEnv);
    };
    const values = (text, field) =>
      new Set([...text.matchAll(new RegExp(`^\\s*${field}\\s*=\\s*"([^"]+)"`, 'gm'))].map((m) => m[1]));

    const prod = block('prod');
    const preview = block('preview');

    for (const field of ['id', 'bucket_name', 'database_id', 'queue']) {
      const shared = [...values(preview, field)].filter((v) => values(prod, field).has(v));
      assert.deepEqual(shared, [], `preview reuses production ${field}: ${shared.join(', ')}`);
    }
  });

  it('gives the gs-api preview environment no cron triggers', () => {
    // The production cron rotates live OAuth tokens daily. Anchored to line
    // start: the manifest's own comment names this table to explain why it is
    // absent, and an unanchored pattern matches that comment.
    assert.doesNotMatch(apiConfig, /^\s*\[env\.preview\.triggers\]/m);
  });
});
