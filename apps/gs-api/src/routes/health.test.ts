import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import health from './health.ts';
import { getDependencyReport } from './health.ts';

describe('Health API', () => {
  it('GET / returns 200 OK and status', async () => {
    const app = new Hono();
    app.route('/', health);

    const res = await app.request('/');
    assert.strictEqual(res.status, 200);
    const data = await res.json() as { status: string; service: string; timestamp: string; version: string };
    assert.strictEqual(data.status, "ok");
    assert.strictEqual(data.service, "gs-api");
    assert.strictEqual(typeof data.timestamp, "string");
    assert.strictEqual(typeof data.version, "string");
  });

  it('GET /unknown returns 404 Not Found', async () => {
    const app = new Hono();
    app.route('/', health);

    const res = await app.request('/unknown');
    assert.strictEqual(res.status, 404);
  });

  it('reports missing readiness dependencies without affecting liveness', async () => {
    const report = await getDependencyReport({});
    assert.strictEqual(report.ready, false);
    assert.strictEqual(report.dependencies.PLATFORM_DB, 'missing');
    assert.strictEqual(report.dependencies.EMAIL, 'missing');
  });

  it('checks KV and D1 when all baseline bindings are present', async () => {
    const report = await getDependencyReport({
      KV: { get: async () => null },
      PLATFORM_DB: { prepare: () => ({ first: async () => ({ 1: 1 }) }) },
      GS_ASSETS: {},
      MAIL_ARCHIVE: {},
      MAIL_JOBS_QUEUE: {},
      EMAIL: {},
      AI: {},
    } as any);
    assert.strictEqual(report.ready, true);
  });
});
