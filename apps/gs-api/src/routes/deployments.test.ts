import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import deployments from './deployments';
import { Env, Variables } from '../types';

const createTestApp = (claims: any = { roles: ['admin'], email: 'admin@goldshore.ai' }, env: Partial<Env> = {}) => {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();

  app.use('*', async (c, next) => {
    c.set('accessClaims', claims);
    c.env = env as Env;
    await next();
  });

  app.route('/deployments', deployments);
  return app;
};

describe('Deployment assistant API', () => {
  it('filters recommendations to Cloudflare-native, security-vetted templates', async () => {
    const app = createTestApp();
    const res = await app.request('/deployments/assistant/search?q=cloudflare%20admin');

    assert.strictEqual(res.status, 200);
    const payload = await res.json() as {
      success: boolean;
      data: { recommendations: Array<{ id: string; cloudflareNative: boolean; securityVetted: boolean }> };
    };

    assert.strictEqual(payload.success, true);
    assert.ok(payload.data.recommendations.length > 0);
    assert.ok(payload.data.recommendations.every((item) => item.cloudflareNative));
    assert.ok(payload.data.recommendations.every((item) => item.securityVetted));
    assert.ok(!payload.data.recommendations.some((item) => item.id === 'generic-jamstack'));
  });

  it('streams ranked recommendations as server-sent events', async () => {
    const app = createTestApp();
    const res = await app.request('/deployments/assistant/stream', {
      method: 'POST',
      body: JSON.stringify({ query: 'Cloudflare admin dashboard' }),
      headers: { 'content-type': 'application/json' },
    });

    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/);
    const text = await res.text();
    assert.match(text, /event: recommendation/);
    assert.match(text, /event: complete/);
  });

  it('blocks dry-run requests for unknown templates', async () => {
    const app = createTestApp();
    const res = await app.request('/deployments/assistant/dry-run', {
      method: 'POST',
      body: JSON.stringify({ templateId: 'missing-template' }),
      headers: { 'content-type': 'application/json' },
    });

    assert.strictEqual(res.status, 404);
  });

  it('returns a dry-run plan for a vetted template', async () => {
    const app = createTestApp();
    const res = await app.request('/deployments/assistant/dry-run', {
      method: 'POST',
      body: JSON.stringify({ templateId: 'astro-pages-functions-admin', workspace: 'apps/gs-web' }),
      headers: { 'content-type': 'application/json' },
    });

    assert.strictEqual(res.status, 202);
    const payload = await res.json() as {
      success: boolean;
      data: { plan: { command: string; workspace: string; deploymentModel: string } };
    };

    assert.strictEqual(payload.success, true);
    assert.strictEqual(payload.data.plan.workspace, 'apps/gs-web');
    assert.match(payload.data.plan.command, /wrangler setup --dry-run/);
  });

  it('requires a completed dry run before draft PR creation', async () => {
    const app = createTestApp();
    const res = await app.request('/deployments/assistant/pr', {
      method: 'POST',
      body: JSON.stringify({
        templateId: 'astro-pages-functions-admin',
        repository: 'marzton/goldshore-ai',
        head: 'codex/admin-deployment-assistant',
        base: 'main',
        query: 'Cloudflare admin dashboard',
        dryRunCommand: 'pnpm wrangler setup --dry-run --cwd apps/gs-web',
      }),
      headers: { 'content-type': 'application/json' },
    });

    assert.strictEqual(res.status, 400);
  });

  it('creates a draft PR through GitHub when a token is available', async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      requests.push({ url, init });

      if (url.includes('api.github.com/repos/marzton/goldshore-ai/pulls')) {
        return new Response(JSON.stringify({ html_url: 'https://github.com/marzton/goldshore-ai/pull/42', number: 42 }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    };

    try {
      const app = createTestApp(undefined, {
        GITHUB_TOKEN: 'gho_test_token',
      });
      const res = await app.request('/deployments/assistant/pr', {
        method: 'POST',
        body: JSON.stringify({
          templateId: 'astro-pages-functions-admin',
          repository: 'marzton/goldshore-ai',
          head: 'codex/admin-deployment-assistant',
          base: 'main',
          query: 'Cloudflare admin dashboard',
          dryRunCommand: 'pnpm wrangler setup --dry-run --cwd apps/gs-web',
          dryRunPassed: true,
        }),
        headers: { 'content-type': 'application/json' },
      });

      assert.strictEqual(res.status, 201);
      const payload = await res.json() as {
        success: boolean;
        status: string;
        data: { prUrl: string | null; prNumber: number | null };
      };

      assert.strictEqual(payload.success, true);
      assert.strictEqual(payload.status, 'created');
      assert.strictEqual(payload.data.prUrl, 'https://github.com/marzton/goldshore-ai/pull/42');
      assert.strictEqual(payload.data.prNumber, 42);
      const githubRequest = requests.find((request) =>
        request.url.includes('api.github.com/repos/marzton/goldshore-ai/pulls'),
      );
      assert.ok(githubRequest);
      const headers = new Headers(githubRequest?.init?.headers as HeadersInit | undefined);
      assert.strictEqual(headers.get('authorization'), 'Bearer gho_test_token');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
