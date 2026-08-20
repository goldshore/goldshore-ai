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

  it('keeps every verified production route on the unified API', () => {
    assert.deepEqual(productionRoutes(apiConfig), [
      { pattern: 'api.goldshore.ai/*', zoneName: 'goldshore.ai' },
      { pattern: 'api.goldshore.org/*', zoneName: 'goldshore.org' },
      { pattern: 'admin.goldshore.ai/*', zoneName: 'goldshore.ai' },
      { pattern: 'agent.goldshore.ai/*', zoneName: 'goldshore.ai' },
      { pattern: 'agent.goldshore.org/*', zoneName: 'goldshore.org' },
      { pattern: 'mail.goldshore.ai/*', zoneName: 'goldshore.ai' },
      { pattern: 'mail.goldshore.org/*', zoneName: 'goldshore.org' },
      { pattern: 'ops.goldshore.ai/*', zoneName: 'goldshore.ai' },
      { pattern: 'trading.goldshore.ai/*', zoneName: 'goldshore.ai' },
      { pattern: 'trading.goldshore.org/*', zoneName: 'goldshore.org' },
      { pattern: 'dashboard.goldshore.ai/*', zoneName: 'goldshore.ai' },
      { pattern: 'dash.goldshore.ai/*', zoneName: 'goldshore.ai' },
      { pattern: 'gw.goldshore.ai/*', zoneName: 'goldshore.ai' },
      // MCP surface folded in from the standalone goldshore-mcp Worker.
      { pattern: 'mcp.goldshore.ai/*', zoneName: 'goldshore.ai' },
    ]);
  });

  it('declares the cron consumed by the scheduled module handler', () => {
    assert.match(apiConfig, /\[env\.prod\.triggers\]\s*crons = \["0 2 \* \* \*"\]/);
  });

  it('keeps databases, object storage, queues, Workflows, and mail off gs-web', () => {
    assert.match(webConfig, /\[assets\][\s\S]*?binding = "ASSETS"/);

    // SESSION is deliberately absent from this list: gs-web binds a KV
    // namespace for Astro session/auth state. Everything transactional still
    // belongs to gs-api.
    assert.doesNotMatch(webConfig, /^binding = "(?:KV|PLATFORM_DB|GS_ASSETS|MAIL_JOBS_QUEUE|EMAIL)"$/m);
    assert.doesNotMatch(webConfig, /\[\[env\.prod\.(?:d1_databases|r2_buckets|queues|services|workflows|send_email)/);

    // gs-web's only permitted KV binding is the session store.
    const webKvBindings = [...webConfig.matchAll(/^binding = "(\w+)"$/gm)]
      .map((m) => m[1])
      .filter((b) => b !== 'ASSETS' && b !== 'IMAGES');
    assert.deepEqual([...new Set(webKvBindings)], ['SESSION']);
  });

  it('declares no dedicated preview Worker environments', () => {
    assert.doesNotMatch(apiConfig, /\[env\.preview(?:\.|\])/);
    assert.doesNotMatch(webConfig, /\[env\.preview(?:\.|\])/);
    assert.doesNotMatch(apiConfig + webConfig, /name\s*=\s*"(?:gs-api|gs-web)-preview"/);
    assert.doesNotMatch(apiConfig + webConfig, /pattern\s*=\s*"(?:api|admin)-preview\./);
    assert.doesNotMatch(apiConfig + webConfig, /(?:queue|bucket_name|workflow_name)\s*=\s*"[^"]*-preview"/);
  });
});
