import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import health from './health.ts';

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
});
