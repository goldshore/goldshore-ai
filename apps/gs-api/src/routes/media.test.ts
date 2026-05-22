import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import media from './media';

const createApp = (claims: any) => {
  const app = new Hono<{ Variables: { accessClaims: any } }>();
  app.use('*', async (c, next) => {
    c.set('accessClaims', claims);
    await next();
  });
  app.route('/', media);
  return app;
};

describe('Media Endpoint Security', () => {
  // Save original fetch
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should serve media files with strict Content-Security-Policy headers', async () => {
    const app = createApp({ roles: ['viewer'] });

    // Mock DB and Assets
    const mockDB = {
      prepare: (query: string) => ({
        bind: (...args: any[]) => ({
          first: async () => ({
            object_key: 'media/123/file.svg',
            type: 'image/svg+xml',
          }),
          all: async () => ({ results: [] }),
          run: async () => {},
        }),
        run: async () => {},
        all: async () => ({ results: [] }),
      }),
    };

    const mockAssets = {
      get: async (key: string) => ({
        body: 'SVG CONTENT',
        httpMetadata: { contentType: 'image/svg+xml' },
      }),
      put: async () => {},
    };
    const res = await app.request(
      '/123',
      {
        method: 'GET',
      },
      {
        DB: mockDB,
        ASSETS: mockAssets,
      },
    );

    assert.strictEqual(res.status, 200);
    const csp = res.headers.get('Content-Security-Policy');
    assert.ok(csp, 'Content-Security-Policy header should be present');
    assert.ok(
      csp.includes("default-src 'none'"),
      'CSP should include default-src none',
    );
    assert.ok(
      csp.includes("script-src 'none'"),
      'CSP should include script-src none',
    );
    assert.ok(
      csp.includes("object-src 'none'"),
      'CSP should include object-src none',
    );
  });

  it('requires media:read permission to list media', async () => {
    const app = createApp({ roles: ['unknown'] });
    const res = await app.request('/', {}, {
      KV: { put: async () => {} },
      DB: {
        prepare: () => ({
          bind: () => ({ all: async () => ({ results: [] }) }),
        }),
      },
    } as any);

    assert.strictEqual(res.status, 403);
  });

  it('should allow uploading small files', async () => {
    const app = createApp({ roles: ['editor'] });

    const mockDB = {
      prepare: (query: string) => ({
        bind: (...args: any[]) => ({
          run: async () => {},
        }),
        run: async () => {},
      }),
    };

    const mockAssets = {
      put: async () => {},
    };
    const formData = new FormData();
    const fileContent = '<svg>small</svg>';
    const file = new File([fileContent], 'test.svg', { type: 'image/svg+xml' });
    formData.append('file', file);

    const req = new Request('http://localhost/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await app.fetch(req, {
      DB: mockDB,
      ASSETS: mockAssets,
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.filename, 'test.svg');
  });
  

  it('sanitizes svg uploads before storing', async () => {
    const app = createApp({ roles: ['editor'] });

    const mockDB = {
      prepare: (_query: string) => ({
        bind: (..._args: any[]) => ({
          run: async () => {},
        }),
      }),
    };

    let storedBody: ArrayBuffer | Uint8Array | undefined;
    const mockAssets = {
      put: async (_key: string, body: ArrayBuffer | Uint8Array) => {
        storedBody = body;
      },
    };
    const formData = new FormData();
    const file = new File([
      '<svg><script>alert(1)</script><foreignObject>bad</foreignObject><rect onclick="evil()" width="10" href=javascript:alert(2)/></svg>',
    ], 'dirty.svg', { type: 'image/svg+xml' });
    formData.append('file', file);

    const req = new Request('http://localhost/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await app.fetch(req, {
      DB: mockDB,
      ASSETS: mockAssets,
    });

    assert.strictEqual(res.status, 200);
    const decoded = new TextDecoder().decode(storedBody as Uint8Array);
    assert.ok(!decoded.includes('<script>'));
    assert.ok(!decoded.includes('onclick='));
    assert.ok(!decoded.includes('foreignObject'));
    assert.ok(!decoded.includes('javascript:'));
  });

  it('should reject files larger than 5MB', async () => {
    const app = createApp({ roles: ['editor'] });

    const mockDB = {
      prepare: (query: string) => ({
        bind: (...args: any[]) => ({
          run: async () => {},
        }),
        run: async () => {},
      }),
    };

    const mockAssets = {
      put: async () => {},
    };
    const formData = new FormData();
    // Create a large file (> 5MB)
    const largeContent = new Uint8Array(5 * 1024 * 1024 + 1);
    const file = new File([largeContent], 'large.png', { type: 'image/png' });
    formData.append('file', file);

    const req = new Request('http://localhost/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await app.fetch(req, {
      DB: mockDB,
      ASSETS: mockAssets,
    });

    assert.strictEqual(res.status, 413, 'Should return 413 Payload Too Large');
  });
});
