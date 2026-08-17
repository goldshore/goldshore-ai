import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { extractAutomationPage, normalizeDomains } from '../lib/automation-jobs';
import automation from './automation';

test('automation domain validation accepts public domains and rejects local targets', () => {
  assert.deepEqual(normalizeDomains(['Example.com', 'https://example.com/about']), ['example.com']);
  assert.equal(normalizeDomains(['localhost']), null);
  assert.equal(normalizeDomains(['internal.local']), null);
  assert.equal(normalizeDomains(Array.from({ length: 51 }, (_, index) => `site${index}.example.com`)), null);
});

test('automation extraction returns bounded public contact and same-origin link data', () => {
  const result = extractAutomationPage(`
    <title>Example Business</title><meta name="description" content="Business services">
    <p>Contact sales@example.com or (212) 555-0100.</p>
    <a href="/contact">Contact</a><a href="https://outside.example.net/page">Outside</a>
  `, 'https://example.com/');
  assert.deepEqual(result.emails, ['sales@example.com']);
  assert.deepEqual(result.phones, ['(212) 555-0100']);
  assert.equal(result.title, 'Example Business');
  assert.deepEqual(result.links, ['https://example.com/contact']);
});

test('automation creation requires explicit robots compliance', async () => {
  const app = new Hono<any>();
  app.use('*', async (c, next) => { c.set('accessClaims', { roles: ['owner'], email: 'owner@example.com' }); await next(); });
  app.route('/automation', automation);
  const response = await app.request('/automation/jobs', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'lead_generator', domains: ['example.com'], maxPages: 3, respectRobots: false }),
  }, {
    JOBS_QUEUE: { send: async () => undefined },
    PLATFORM_DB: {},
  } as any);
  assert.equal(response.status, 400);
  assert.match(await response.text(), /Robots\.txt compliance is required/);
});
