import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import internal from './internal.ts';
import { type AccessTokenPayload } from '@goldshore/auth';
import { type Env, type Variables } from '../types.ts';

const createApp = (claims: AccessTokenPayload | null) => {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  app.use('*', async (c, next) => {
    c.set('accessClaims', claims);
    await next();
  });
  app.route('/internal', internal);
  return app;
};

describe('internal inbox status', () => {
  it('requires system:read permission', async () => {
    const app = createApp({ roles: ['viewer'] } as AccessTokenPayload);
    const res = await app.request('/internal/inbox-status', {}, { KV: { get: async () => null } } as any);
    assert.strictEqual(res.status, 403);
  });

  it('returns inbox summary and service status', async () => {
    const app = createApp({ roles: ['admin'] } as AccessTokenPayload);

    const kv = {
      get: async (key: string, type?: string) => {
        if (key === 'EMAIL_INBOX_LOGS') {
          return [
            { id: '11111111-1111-4111-8111-111111111111', from: 'a@example.com', to: 'mail@goldshore.ai', subject: 'Hello', timestamp: '2026-03-03T00:00:00.000Z' },
            { id: '22222222-2222-4222-8222-222222222222', from: 'b@example.com', to: 'mail@goldshore.ai', subject: 'World', timestamp: '2026-03-03T01:00:00.000Z' },
          ];
        }
        if (key === 'SERVICE_STATUS') {
          return { maintenance_mode: false, active_services: ['gateway', 'api'], version: '2026.03.04' };
        }
        return null;
      },
    };

    const res = await app.request('/internal/inbox-status', {}, { KV: kv } as any);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as any;
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.inbox.count, 2);
    assert.strictEqual(data.inbox.recent.length, 2);
    assert.deepStrictEqual(data.services.active_services, ['gateway', 'api']);
  });

  it('returns dns sync telemetry and MASTER_CONFIG report fields', async () => {
    const app = createApp({ roles: ['admin'] } as AccessTokenPayload);

    const run = {
      runId: 'run-1',
      actor: 'cron:scheduled',
      startedAt: '2026-03-04T00:00:00.000Z',
      endedAt: '2026-03-04T00:00:15.000Z',
      success: false,
      driftStatus: 'drifted',
      results: [
        {
          hostname: 'api.goldshore.ai',
          checkUrl: 'https://api.goldshore.ai/health',
          startedAt: '2026-03-04T00:00:00.000Z',
          endedAt: '2026-03-04T00:00:05.000Z',
          statusCode: 500,
          success: false,
          driftStatus: 'drifted',
          driftNotes: ['Health check failed with HTTP 500.'],
        },
      ],
    };

    const controlLogs = {
      get: async (key: string) => {
        if (key === 'dns_sync_runs_index') return ['dns_sync_run:2026-03-04T00:00:00.000Z:run-1'];
        if (key === 'dns_sync_run:2026-03-04T00:00:00.000Z:run-1') return run;
        return null;
      },
    };

    const kv = {
      get: async (key: string) => {
        if (key === 'SERVICE_STATUS') {
          return { maintenance_mode: false, active_services: ['gateway', 'api'], version: '2026.03.04', last_sync: '2026-03-03T23:00:00.000Z' };
        }
        return null;
      },
    };

    const res = await app.request('/internal/dns-sync-status', {}, { KV: kv, CONTROL_LOGS: controlLogs } as any);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as any;
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.masterConfigReport.syncSource, 'durable');
    assert.strictEqual(data.masterConfigReport.driftStatusComputed, 'drifted');
    assert.strictEqual(data.masterConfigReport.lastSyncTimestampVerified, '2026-03-04T00:00:15.000Z');
    assert.strictEqual(data.latestRun.results[0].hostname, 'api.goldshore.ai');
  });
});
