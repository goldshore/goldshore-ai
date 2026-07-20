import http from 'node:http';
import { Buffer } from 'node:buffer';
import app from './index.ts';
import type { Env as ApiEnv } from './types';

const now = () => new Date().toISOString();

class MemoryKV {
  private store = new Map<string, string>();

  constructor(seed: Record<string, unknown>) {
    for (const [key, value] of Object.entries(seed)) {
      this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }

  async get(key: string, type?: 'json') {
    const value = this.store.get(key);
    if (value === undefined) {
      return null;
    }
    if (type === 'json') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return value;
  }

  async put(key: string, value: string) {
    this.store.set(key, value);
  }

  async delete(key: string) {
    this.store.delete(key);
  }

  async list({ prefix = '' }: { prefix?: string } = {}) {
    return {
      keys: [...this.store.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((name) => ({ name })),
    };
  }
}

type PageRow = {
  id: number;
  slug: string;
  title: string;
  body: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type MediaRow = {
  id: string;
  filename: string;
  url: string;
  size: number;
  type: string;
  object_key: string;
  created_at: string;
};

class MemoryStatement<T = unknown> {
  constructor(private db: MemoryDB, private sql: string, private params: unknown[] = []) {}

  bind(...params: unknown[]) {
    return new MemoryStatement<T>(this.db, this.sql, params);
  }

  async all<TResult = T>() {
    return { results: this.db.executeAll<TResult>(this.sql, this.params) };
  }

  async first<TResult = T>() {
    return this.db.executeFirst<TResult>(this.sql, this.params);
  }

  async run() {
    return { meta: { changes: this.db.executeRun(this.sql, this.params) } };
  }
}

class MemoryDB {
  private pages: PageRow[] = [
    {
      id: 1,
      slug: 'home',
      title: 'GoldShore Home',
      body: '<h1>GoldShore Local Dev</h1><p>Production content with preview styling.</p>',
      status: 'published',
      created_at: now(),
      updated_at: now(),
    },
    {
      id: 2,
      slug: 'services',
      title: 'Services',
      body: '<h1>Services</h1><p>Trading, automation, agents, and internal tooling.</p>',
      status: 'draft',
      created_at: now(),
      updated_at: now(),
    },
  ];

  private media: MediaRow[] = [];
  private nextPageId = 3;

  prepare(sql: string) {
    return new MemoryStatement(this, sql);
  }

  private norm(sql: string) {
    return sql.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  executeAll<TResult>(sql: string, params: unknown[]) {
    const query = this.norm(sql);
    if (query === 'select * from pages order by updated_at desc') {
      return [...this.pages].sort((a, b) => b.updated_at.localeCompare(a.updated_at)) as TResult[];
    }
    if (query === 'select * from pages where status = ? order by updated_at desc') {
      const status = String(params[0] ?? '');
      return [...this.pages]
        .filter((page) => page.status === status)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)) as TResult[];
    }
    if (query === 'select id, filename, url, size, type, created_at from media_assets order by created_at desc limit ? offset ?') {
      const limit = Number(params[0] ?? 100);
      const offset = Number(params[1] ?? 0);
      return this.media.slice(offset, offset + limit).map(({ id, filename, url, size, type, created_at }) => ({ id, filename, url, size, type, created_at })) as TResult[];
    }
    return [] as TResult[];
  }

  executeFirst<TResult>(sql: string, params: unknown[]) {
    const query = this.norm(sql);
    if (query === 'select 1') {
      return { 1: 1 } as TResult;
    }
    if (query === 'select * from pages where slug = ? limit 1') {
      const slug = String(params[0] ?? '');
      return (this.pages.find((page) => page.slug === slug) ?? null) as TResult;
    }
    if (query === 'select * from pages where id = ? limit 1') {
      const id = Number(params[0]);
      return (this.pages.find((page) => page.id === id) ?? null) as TResult;
    }
    if (query === 'insert into pages (slug, title, body, status) values (?, ?, ?, ?) returning *') {
      return this.insertPage(params) as TResult;
    }
    if (query === "update pages set slug = ?, title = ?, body = ?, status = ?, updated_at = datetime('now') where id = ? returning *") {
      return this.updatePage(params) as TResult;
    }
    if (query === "update pages set status = ?, updated_at = datetime('now') where id = ? returning *") {
      return this.updatePageStatus(params) as TResult;
    }
    if (query === 'select object_key, type from media_assets where id = ?') {
      const id = String(params[0] ?? '');
      const record = this.media.find((item) => item.id === id);
      return record ? ({ object_key: record.object_key, type: record.type } as TResult) : null;
    }
    if (query === 'select * from media_assets where id = ? limit 1') {
      const id = String(params[0] ?? '');
      return (this.media.find((item) => item.id === id) ?? null) as TResult;
    }
    return null as TResult;
  }

  executeRun(sql: string, params: unknown[]) {
    const query = this.norm(sql);
    if (query === 'delete from pages where id = ?') {
      const id = Number(params[0]);
      const before = this.pages.length;
      this.pages = this.pages.filter((page) => page.id !== id);
      return before === this.pages.length ? 0 : 1;
    }
    if (query === 'insert into media_assets (id, filename, url, size, type, object_key, created_at) values (?, ?, ?, ?, ?, ?, ?)') {
      this.media.push({
        id: String(params[0]),
        filename: String(params[1]),
        url: String(params[2]),
        size: Number(params[3]),
        type: String(params[4]),
        object_key: String(params[5]),
        created_at: String(params[6]),
      });
      return 1;
    }
    return 0;
  }

  private insertPage(params: unknown[]) {
    const row: PageRow = {
      id: this.nextPageId++,
      slug: String(params[0]),
      title: String(params[1]),
      body: String(params[2]),
      status: String(params[3]),
      created_at: now(),
      updated_at: now(),
    };
    this.pages.unshift(row);
    return row;
  }

  private updatePage(params: unknown[]) {
    const id = Number(params[4]);
    const page = this.pages.find((item) => item.id === id);
    if (!page) return null;
    page.slug = String(params[0]);
    page.title = String(params[1]);
    page.body = String(params[2]);
    page.status = String(params[3]);
    page.updated_at = now();
    return page;
  }

  private updatePageStatus(params: unknown[]) {
    const id = Number(params[1]);
    const page = this.pages.find((item) => item.id === id);
    if (!page) return null;
    page.status = String(params[0]);
    page.updated_at = now();
    return page;
  }
}

class MemoryAssetBucket {
  private assets = new Map<string, { body: Uint8Array; contentType?: string }>();

  async get(key: string) {
    const asset = this.assets.get(key);
    if (!asset) {
      return null;
    }
    return {
      body: asset.body,
      httpMetadata: asset.contentType ? { contentType: asset.contentType } : undefined,
    };
  }

  async put(key: string, body: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
    this.assets.set(key, {
      body: body instanceof Uint8Array ? body : new Uint8Array(body),
      contentType: options?.httpMetadata?.contentType,
    });
  }
}

const devEnv: ApiEnv & { DEV_AUTH_BYPASS: string; ENV: string } = {
  KV: new MemoryKV({
    SERVICE_STATUS: {
      maintenance_mode: false,
      active_services: ['api', 'web', 'agent', 'trading'],
      version: 'local-dev',
      api_config: {},
    },
    ROUTING_TABLE: {
      'goldshore.ai': { target: 'http://127.0.0.1:4322' },
      'admin.goldshore.ai': { target: 'http://127.0.0.1:4322/admin' },
      'api.goldshore.ai': { target: 'http://127.0.0.1:8787' },
    },
    AI_ORCHESTRATION: {
      preferred_model: 'gpt-4o-mini',
      queue_concurrency: 1,
    },
    EMAIL_INBOX_LOGS: [],
  }) as unknown as KVNamespace,
  CONTROL_LOGS: new MemoryKV({}) as unknown as KVNamespace,
  DB: new MemoryDB() as unknown as D1Database,
  ASSETS: new MemoryAssetBucket() as unknown as R2Bucket,
  AI: {} as Ai,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  CLOUDFLARE_ACCESS_AUDIENCE: process.env.CLOUDFLARE_ACCESS_AUDIENCE,
  CLOUDFLARE_TEAM_DOMAIN: process.env.CLOUDFLARE_TEAM_DOMAIN,
  API_VERSION: 'local-dev',
  DEPLOY_SHA: 'local-dev',
  GIT_SHA: 'local-dev',
  DEV_AUTH_BYPASS: '1',
  ENV: 'development',
};

const server = http.createServer((req, res) => {
  void (async () => {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1:8787'}`);
    const chunks: Buffer[] = [];

    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const hasBody = !['GET', 'HEAD'].includes(method);
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
    const request = new Request(url, {
      method,
      headers: req.headers as HeadersInit,
      body: hasBody ? body : undefined,
    });

    const response = await app.fetch(request, devEnv);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));

    const responseBody = response.body ? Buffer.from(await response.arrayBuffer()) : Buffer.alloc(0);
    res.end(responseBody);
  })().catch((error) => {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Dev server failure', message: String(error?.message ?? error) }));
  });
});

const portFlagIndex = process.argv.findIndex((arg) => arg === '--port' || arg.startsWith('--port='));
const port = Number(
  portFlagIndex === -1
    ? process.env.PORT ?? 8787
    : process.argv[portFlagIndex].includes('=')
      ? process.argv[portFlagIndex].split('=')[1]
      : process.argv[portFlagIndex + 1] ?? process.env.PORT ?? 8787,
);
server.listen(port, '127.0.0.1', () => {
  console.log(`gs-api dev server listening at http://127.0.0.1:${port}`);
});