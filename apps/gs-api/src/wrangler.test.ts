import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), '../wrangler.toml');
const wranglerConfig = readFileSync(fixturePath, 'utf8');
const workerSource = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'index.ts'), 'utf8');
const prod = wranglerConfig.slice(wranglerConfig.indexOf('[env.prod]'));
const d1Bindings = [...prod.matchAll(/\[\[env\.prod\.d1_databases\]\]\s*binding = "([^"]+)"/g)]
  .map((match) => match[1]);

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
      'agent.goldshore.org', 'mail.goldshore.org', 'ops.goldshore.ai', 'trading.goldshore.ai',
      'trading.goldshore.org', 'dashboard.goldshore.ai', 'dash.goldshore.ai', 'gw.goldshore.ai',
    ]) {
      assert.ok(
        prod.includes('pattern = "' + hostname + '/*"'),
        'missing route for ' + hostname,
      );
    }
  });

  it('keeps event triggers and the signals Workflow wired to exported handlers', () => {
    assert.match(prod, /\[env\.prod\.triggers\]\s*crons = \["0 2 \* \* \*"\]/);
    assert.match(
      prod,
      /\[\[env\.prod\.workflows\]\][\s\S]*?binding = "GS_SIGNALS"[\s\S]*?name = "gs-signals-evaluator"[\s\S]*?class_name = "SignalsEvaluator"/,
    );
    assert.ok(!d1Bindings.includes('GS_SIGNALS'));
    assert.match(workerSource, /export \{ SignalsEvaluator \} from '\.\/workers\/signals-evaluator';/);
    assert.match(workerSource, /async queue\(batch: MessageBatch<unknown>, env: Env\)/);
    assert.match(workerSource, /async scheduled\(controller: ScheduledController, env: Env, ctx: ExecutionContext\)/);
    assert.match(workerSource, /controller\.cron === '0 2 \* \* \*'/);
    assert.match(workerSource, /async email\(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext\)/);
  });
});
