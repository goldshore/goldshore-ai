import { Hono } from 'hono';
import { requirePermission } from '../auth';
import { Env, Variables } from '../types';

type MediaRecord = {
  id: string;
  filename: string;
  url: string;
  size: number;
  type: string;
  created_at: string;
};

type UploadFileLike = {
  name: string;
  size: number;
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

const ALLOWED_MIME_TYPES = new Map([
  ['svg', 'image/svg+xml'],
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit

const SVG_DANGEROUS_TAGS_REGEX =
  /<(script|iframe|object|embed|link|meta|style|foreignObject|animate|set|discard)[\s\S]*?>[\s\S]*?<\/\1>/gi;
const SVG_DANGEROUS_SELF_CLOSING_TAGS_REGEX =
  /<(script|iframe|object|embed|link|meta|style|foreignObject|animate|set|discard)\b[^>]*\/?>/gi;
const SVG_EVENT_HANDLER_ATTR_REGEX =
  /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const SVG_SCRIPTABLE_URL_ATTR_QUOTED_REGEX =
  /\s+(?:href|xlink:href|src)\s*=\s*("|')\s*(?:javascript:|data:text\/html)[\s\S]*?\1/gi;
const SVG_SCRIPTABLE_URL_ATTR_UNQUOTED_REGEX =
  /\s+(?:href|xlink:href|src)\s*=\s*(?:javascript:|data:text\/html)[^\s>]*/gi;

const sanitizeSvg = (input: string): string => {
  let current = input;
  let previous: string;

  do {
    previous = current;
    current = current
      .replace(SVG_DANGEROUS_TAGS_REGEX, '')
      .replace(SVG_DANGEROUS_SELF_CLOSING_TAGS_REGEX, '')
      .replace(SVG_EVENT_HANDLER_ATTR_REGEX, '')
      .replace(SVG_SCRIPTABLE_URL_ATTR_QUOTED_REGEX, '')
      .replace(SVG_SCRIPTABLE_URL_ATTR_UNQUOTED_REGEX, '');
  } while (current !== previous);

  return current;
};

const isUploadFileLike = (value: unknown): value is UploadFileLike => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<UploadFileLike>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.size === 'number' &&
    typeof candidate.text === 'function' &&
    typeof candidate.arrayBuffer === 'function'
  );
};

/**
 * [SOP] Media Asset Management
 * Handles R2 storage for images and SVGs with strict sanitization for vector assets.
 */

const media = new Hono<{ Bindings: Env; Variables: Variables }>();

media.get('/', requirePermission('media:read'), async (c) => {
  const query = c.req.query();
  const rawLimit = query.limit;
  const rawOffset = query.offset;

  let limit = 100;
  let offset = 0;

  if (typeof rawLimit === 'string') {
    const parsed = parseInt(rawLimit, 10);
    if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 500) {
      limit = parsed;
    }
  }

  if (typeof rawOffset === 'string') {
    const parsed = parseInt(rawOffset, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      offset = parsed;
    }
  }

  const { results } = await c.env.DB.prepare(
    'SELECT id, filename, url, size, type, created_at FROM media_assets ORDER BY created_at DESC LIMIT ? OFFSET ?',
  )
    .bind(limit, offset)
    .all<MediaRecord>();

  return c.json({ items: results ?? [] });
});

media.get('/:id', requirePermission('media:read'), async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare(
    'SELECT object_key, type FROM media_assets WHERE id = ?',
  )
    .bind(id)
    .first<{ object_key: string; type: string }>();

  if (!result) return c.json({ error: 'Media not found' }, 404);

  const object = await c.env.ASSETS.get(result.object_key);
  if (!object) return c.json({ error: 'Asset missing from storage' }, 404);

  const headers = new Headers();
  headers.set(
    'Content-Type',
    result.type ||
      object.httpMetadata?.contentType ||
      'application/octet-stream',
  );
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  // Sentinel: Enforce strict CSP to mitigate SVG XSS
  headers.set(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'none'; object-src 'none'; sandbox",
  );

  return new Response(object.body, { headers });
});

media.post('/upload', requirePermission('media:write'), async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!isUploadFileLike(file))
    return c.json({ error: 'Missing file upload' }, 400);
  if (file.size > MAX_FILE_SIZE)
    return c.json({ error: 'File too large' }, 413);

  const filename = file.name || 'upload';
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  const contentType = ALLOWED_MIME_TYPES.get(extension);

  if (!contentType) return c.json({ error: 'Unsupported file type' }, 400);

  let body: ArrayBuffer | Uint8Array;
  let size = file.size;

  if (contentType === 'image/svg+xml') {
    const sanitizedSvg = sanitizeSvg(await file.text());
    const trimmed = sanitizedSvg.trim();
    // Ensure sanitized SVG is still non-empty and appears to be valid SVG markup
    if (!trimmed || !/<svg[\s>]/i.test(trimmed)) {
      return c.json({ error: 'Invalid SVG after sanitization' }, 400);
    }
    const encoded = new TextEncoder().encode(trimmed);
    body = encoded;
    size = encoded.byteLength;
  } else {
    body = await file.arrayBuffer();
  }

  const id = crypto.randomUUID();
  const objectKey = `media/${id}`;

  await c.env.ASSETS.put(objectKey, body, { httpMetadata: { contentType } });

  const url = new URL(c.req.url);
  url.pathname = `/media/${id}`;

  const createdAt = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO media_assets (id, filename, url, size, type, object_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, filename, url.toString(), size, contentType, objectKey, createdAt)
    .run();

  return c.json({
    id,
    filename,
    url: url.toString(),
    size,
    type: contentType,
    created_at: createdAt,
  });
});

export default media;
