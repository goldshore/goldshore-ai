import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

type Env = {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  ENVIRONMENT: string;
  GS_AGENT_BASE: string;
  GS_API_BASE: string;
  GS_INTERNAL_SECRET: string;
  GS_SIGNALS_BASE: string;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id"
};

const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
});

const err = (message: unknown): ToolResult => ({
  content: [{ type: "text", text: `ERROR: ${String(message)}` }],
  isError: true
});

async function cfApi(path: string, env: Env, init: RequestInit = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  const text = await response.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Some Cloudflare endpoints return plain text for error paths.
  }

  return {
    status: response.status,
    ok: response.ok,
    data
  };
}

async function gsApi(base: string, path: string, env: Env, init: RequestInit = {}) {
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      "X-GS-Secret": env.GS_INTERNAL_SECRET,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
}

async function getZoneId(zoneName: string, env: Env) {
  const response = await cfApi(`/zones?name=${encodeURIComponent(zoneName)}`, env);
  const result = response.data as { result?: Array<{ id: string }> };
  return result.result?.[0]?.id ?? null;
}

function asPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function buildServer(env: Env) {
  const server = new McpServer({
    name: "GoldShore MCP",
    version: "1.0.0"
  });

  server.tool(
    "fetch_url",
    "Fetch any URL. Use for web scraping, calling external APIs, research.",
    {
      url: z.string().url(),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("GET"),
      headers: z.record(z.string()).optional(),
      body: z.string().optional()
    },
    async ({ url, method, headers, body }) => {
      try {
        const response = await fetch(url, {
          method,
          headers: { "User-Agent": "GoldShore-MCP/1.0", ...(headers ?? {}) },
          body: body ?? undefined
        });
        const text = await response.text();
        let data: unknown = text;
        try {
          data = JSON.parse(text);
        } catch {
          // Keep non-JSON responses as text.
        }
        return ok({ status: response.status, url, data });
      } catch (error) {
        return err(error);
      }
    }
  );

  server.tool("list_workers", "List all Cloudflare Workers in the goldshore account.", {}, async () => {
    return ok(await cfApi(`/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts`, env));
  });

  server.tool(
    "deploy_worker_from_code",
    "Deploy a Cloudflare Worker from source code. Returns the deployment result.",
    {
      name: z.string().min(1),
      code: z.string().min(1),
      compatibilityDate: z.string().default("2025-11-01")
    },
    async ({ name, code, compatibilityDate }) => {
      try {
        const boundary = `----gs-mcp-${crypto.randomUUID()}`;
        const metadata = {
          main_module: "index.js",
          compatibility_date: compatibilityDate,
          bindings: []
        };
        const body = [
          `--${boundary}`,
          'Content-Disposition: form-data; name="metadata"',
          "Content-Type: application/json",
          "",
          JSON.stringify(metadata),
          `--${boundary}`,
          'Content-Disposition: form-data; name="index.js"; filename="index.js"',
          "Content-Type: application/javascript+module",
          "",
          code,
          `--${boundary}--`
        ].join("\r\n");

        return ok(
          await cfApi(`/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${name}`, env, {
            method: "PUT",
            body,
            headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` }
          })
        );
      } catch (error) {
        return err(error);
      }
    }
  );

  server.tool(
    "list_dns_records",
    "List DNS records for goldshore.ai.",
    {
      name: z.string().optional(),
      type: z.string().optional()
    },
    async ({ name, type }) => {
      const zoneId = await getZoneId("goldshore.ai", env);
      if (!zoneId) return err("goldshore.ai zone not found");
      const query = new URLSearchParams();
      if (name) query.set("name", name);
      if (type) query.set("type", type);
      return ok(await cfApi(`/zones/${zoneId}/dns_records?${query}`, env));
    }
  );

  server.tool(
    "create_dns_record",
    "Create a DNS record on goldshore.ai.",
    {
      type: z.string(),
      name: z.string(),
      content: z.string(),
      proxied: z.boolean().optional(),
      ttl: z.number().int().optional()
    },
    async (record) => {
      const zoneId = await getZoneId("goldshore.ai", env);
      if (!zoneId) return err("goldshore.ai zone not found");
      return ok(
        await cfApi(`/zones/${zoneId}/dns_records`, env, {
          method: "POST",
          body: JSON.stringify({ ttl: 1, ...record })
        })
      );
    }
  );

  server.tool("d1_list_databases", "List all D1 SQLite databases.", {}, async () => {
    return ok(await cfApi(`/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database`, env));
  });

  server.tool(
    "d1_query",
    "Run a SQL query against a D1 database.",
    {
      databaseId: z.string(),
      sql: z.string(),
      params: z.array(z.unknown()).optional()
    },
    async ({ databaseId, sql, params }) => {
      return ok(
        await cfApi(`/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`, env, {
          method: "POST",
          body: JSON.stringify({ sql, params })
        })
      );
    }
  );

  server.tool("kv_list_namespaces", "List all Cloudflare KV namespaces.", {}, async () => {
    return ok(await cfApi(`/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces`, env));
  });

  server.tool("r2_list_buckets", "List all R2 storage buckets.", {}, async () => {
    return ok(await cfApi(`/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets`, env));
  });

  server.tool(
    "ai_run",
    "Run a Workers AI model. Good for quick text generation, summarization, or classification without leaving the platform.",
    {
      model: z.string().default("@cf/meta/llama-3.1-8b-instruct"),
      input: z.record(z.unknown())
    },
    async ({ model, input }) => {
      return ok(
        await cfApi(`/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`, env, {
          method: "POST",
          body: JSON.stringify(input)
        })
      );
    }
  );

  server.tool(
    "get_market_signals",
    "Get market signals and trading intel from the goldshore signals platform.",
    {
      endpoint: z.string().default("/"),
      params: z.record(z.string()).optional()
    },
    async ({ endpoint, params }) => {
      try {
        const query = params ? `?${new URLSearchParams(params)}` : "";
        const response = await gsApi(env.GS_SIGNALS_BASE, `${asPath(endpoint)}${query}`, env);
        return ok(await response.json());
      } catch (error) {
        return err(error);
      }
    }
  );

  server.tool(
    "call_gs_api",
    "Call any goldshore.ai internal API - content, users, forms, analytics, platform ops.",
    {
      path: z.string(),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("GET"),
      body: z.unknown().optional(),
      params: z.record(z.string()).optional()
    },
    async ({ path, method, body, params }) => {
      try {
        const query = params ? `?${new URLSearchParams(params)}` : "";
        const response = await gsApi(env.GS_API_BASE, `${asPath(path)}${query}`, env, {
          method,
          body: body === undefined ? undefined : JSON.stringify(body)
        });
        const text = await response.text();
        try {
          return ok(JSON.parse(text));
        } catch {
          return ok(text);
        }
      } catch (error) {
        return err(error);
      }
    }
  );

  server.tool(
    "get_zone_analytics",
    "Get traffic analytics for goldshore.ai - requests, bandwidth, threats.",
    {
      since: z.string().optional(),
      until: z.string().optional()
    },
    async ({ since, until }) => {
      const zoneId = await getZoneId("goldshore.ai", env);
      if (!zoneId) return err("goldshore.ai zone not found");
      const now = new Date();
      const start = since ?? new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const end = until ?? now.toISOString();
      const query = `
        query GoldshoreZoneAnalytics($zoneTag: string, $since: Time, $until: Time) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              httpRequests1hGroups(limit: 24, filter: { datetime_geq: $since, datetime_leq: $until }) {
                dimensions { datetime }
                sum { requests bytes threats }
              }
            }
          }
        }
      `;
      return ok(
        await cfApi("/graphql", env, {
          method: "POST",
          body: JSON.stringify({ query, variables: { zoneTag: zoneId, since: start, until: end } })
        })
      );
    }
  );

  server.tool(
    "scaffold_worker",
    "Generate a ready-to-deploy Cloudflare Worker scaffold (files + deploy instructions).",
    {
      name: z.string(),
      description: z.string().default("Generated by GoldShore MCP"),
      type: z.enum(["api", "webhook", "cron", "proxy", "ai-agent"]).default("api")
    },
    async ({ name, description, type }) => {
      const code = {
        api: `// ${description}
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return Response.json({ ok: true });
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
};`,
        webhook: `// ${description}
export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const payload = await req.json();
    console.log('Webhook:', payload);
    return Response.json({ received: true });
  }
};`,
        cron: `// ${description}
export default {
  async scheduled(event, env, ctx) {
    console.log('Cron at', new Date(event.scheduledTime).toISOString());
  }
};`,
        proxy: `// ${description}
export default {
  async fetch(req, env) {
    const upstream = 'https://example.com';
    return fetch(new Request(upstream + new URL(req.url).pathname, req));
  }
};`,
        "ai-agent": `// ${description}
export default {
  async fetch(req, env) {
    const { messages } = await req.json();
    const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { messages });
    return Response.json(result);
  }
};`
      };

      return ok({
        "wrangler.toml": `name = "${name}"
main = "index.js"
compatibility_date = "2025-11-01"
${type === "cron" ? '[triggers]\ncrons = ["0 * * * *"]' : ""}${type === "ai-agent" ? '\n[ai]\nbinding = "AI"' : ""}`,
        "index.js": code[type],
        deploy: "wrangler deploy",
        preview: "wrangler dev"
      });
    }
  );

  return server;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "gs-mcp", version: "1.0.0" });
    }

    if (!url.pathname.startsWith("/mcp")) {
      return new Response("Not found", { status: 404 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const server = buildServer(env);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    const response = await transport.handleRequest(request);

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      headers.set(key, value);
    }

    return new Response(response.body, { status: response.status, headers });
  }
};
