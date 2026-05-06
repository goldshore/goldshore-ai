import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import media from './media';

describe('Media Endpoint Security', () => {
  // Save original fetch
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should serve media files with strict Content-Security-Policy headers', async () => {
    const app = new Hono();

    // Mock DB and Assets
    const mockDB = {
      prepare: (query: string) => ({
        bind: (...args: any[]) => ({
          first: async () => ({ object_key: 'media/123/file.svg', type: 'image/svg+xml' }),
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
        httpMetadata: { contentType: 'image/svg+xml' }
      }),
      put: async () => {},
    };

    app.route('/', media);

    const res = await app.request('/123', {
      method: 'GET',
    }, {
      DB: mockDB,
      ASSETS: mockAssets,
    });

    assert.strictEqual(res.status, 200);
    const csp = res.headers.get('Content-Security-Policy');
    assert.ok(csp, 'Content-Security-Policy header should be present');
    assert.ok(csp.includes("default-src 'none'"), 'CSP should include default-src none');
    assert.ok(csp.includes("script-src 'none'"), 'CSP should include script-src none');
    assert.ok(csp.includes("object-src 'none'"), 'CSP should include object-src none');
  });

  it('should allow uploading small files', async () => {
    const app = new Hono();

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

    app.route('/', media);

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

  it('should reject files larger than 5MB', async () => {
    const app = new Hono();

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

    app.route('/', media);

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
