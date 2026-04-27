import { Hono } from 'hono';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

type MediaRecord = {
  id: string;
  filename: string;
  url: string;
  size: number;
  type: string;
  created_at: string;
};

const ALLOWED_MIME_TYPES = new Map([
  ['svg', 'image/svg+xml'],
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg']
]);

// 5MB limit to prevent DoS via large file uploads
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const sanitizeSvg = (rawSvg: string) => {
  // Use DOMPurify with JSDOM to robustly sanitize SVG content and strip
  // event handlers, scripts, and other active content.
  const { window } = new JSDOM('');
  const DOMPurify = createDOMPurify(window as unknown as Window);

  let sanitized = DOMPurify.sanitize(rawSvg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Ensure scriptable attributes and event handlers are removed.
    ADD_TAGS: [],
    ADD_ATTR: []
  });

  if (!sanitized.trim().startsWith('<svg')) {
    sanitized = `<svg xmlns="http://www.w3.org/2000/svg">${sanitized}</svg>`;
  }

  return sanitized;
};

const media = new Hono<{ Bindings: { DB: D1Database; ASSETS: R2Bucket } }>();

media.get('/', async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT id, filename, url, size, type, created_at FROM media_assets ORDER BY created_at DESC LIMIT 100')
    .all<MediaRecord>();
  return c.json({ items: results ?? [] });
});

media.get('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB
    .prepare('SELECT object_key, type FROM media_assets WHERE id = ?')
    .bind(id)
    .first<{ object_key: string; type: string }>();

  if (!result) {
    return c.json({ error: 'Media not found' }, 404);
  }

  const object = await c.env.ASSETS.get(result.object_key);
  if (!object) {
    return c.json({ error: 'Asset missing from storage' }, 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', result.type || object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  // Sentinel: Mitigate SVG XSS risks by disabling scripts
  headers.set('Content-Security-Policy', "default-src 'none'; script-src 'none'; object-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; sandbox");

  return new Response(object.body, { headers });
});

media.post('/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return c.json({ error: 'Missing file upload' }, 400);
  }

  const filename = file.name || 'upload';
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  const contentType = ALLOWED_MIME_TYPES.get(extension);

  if (!contentType) {
    return c.json({ error: 'Unsupported file type' }, 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File too large' }, 413);
  }

  let body: ArrayBuffer | Uint8Array;
  let size = file.size;

  if (contentType === 'image/svg+xml') {
    const rawSvg = await file.text();
    const sanitizedSvg = sanitizeSvg(rawSvg);
    const encoded = new TextEncoder().encode(sanitizedSvg);
    body = encoded;
    size = encoded.byteLength;
  } else {
    body = await file.arrayBuffer();
  }

  const id = crypto.randomUUID();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectKey = `media/${id}/${safeName}`;

  await c.env.ASSETS.put(objectKey, body, {
    httpMetadata: {
      contentType
    }
  });

  const url = new URL(c.req.url);
  url.pathname = `/media/${id}`;

  const createdAt = new Date().toISOString();
  await c.env.DB
    .prepare(
      'INSERT INTO media_assets (id, filename, url, size, type, object_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(id, filename, url.toString(), size, contentType, objectKey, createdAt)
    .run();

  return c.json({
    id,
    filename,
    url: url.toString(),
    size,
    type: contentType,
    created_at: createdAt
  });
});

export default media;
