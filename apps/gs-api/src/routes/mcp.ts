import { Hono } from 'hono';
import type { Env, Variables } from '../types';

/**
 * MCP (Model Context Protocol) surface, folded into gs-api.
 *
 * Replaces the standalone `goldshore-mcp` Worker, which never worked in
 * production: its wrangler.toml shipped `id = "placeholder_kv_id"` for the
 * MCP_SESSIONS namespace and declared no `durable_objects` block, while its
 * handler used `McpAgent` from `agents/mcp` — a Durable Object. Every request
 * to the wrapped path threw, which is the Cloudflare 1101 the live host returns.
 *
 * This port speaks the Streamable HTTP transport directly as JSON-RPC 2.0 over
 * POST. That needs no Durable Object, no KV namespace, and no new dependency —
 * so it carries none of the failure modes above and satisfies the two-app rule
 * in AGENTS.md, which routes backend work into gs-api rather than a new Worker.
 *
 * Sessions are deliberately absent: every method here is a pure function of its
 * request, so there is no state to keep between calls and no Mcp-Session-Id to
 * issue. Access is gated upstream by Cloudflare Access on the mounted hostname.
 */

const mcp = new Hono<{ Bindings: Env; Variables: Variables }>();

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_NAME = 'goldshore-mcp';
const SERVER_VERSION = '1.0.0';

const CF_API = 'https://api.cloudflare.com/client/v4';

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

/** JSON-RPC 2.0 reserved codes. */
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;

const result = (id: JsonRpcId, value: unknown) => ({ jsonrpc: '2.0', id, result: value });

const failure = (id: JsonRpcId, code: number, message: string) => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
});

/** MCP tool results carry their payload as content blocks, errors included. */
const text = (value: string, isError = false) => ({
  content: [{ type: 'text', text: value }],
  ...(isError ? { isError: true } : {}),
});

const TOOLS = [
  {
    name: 'cloudflare_list_workers',
    description: 'List all Cloudflare Workers in the account',
    path: (account: string) => `accounts/${account}/workers/scripts`,
    format: (data: { result?: Array<{ id: string; modified_on: string }> }) =>
      (data.result ?? []).map((w) => `${w.id} (modified: ${w.modified_on})`),
    empty: 'No workers found.',
  },
  {
    name: 'cloudflare_list_kv_namespaces',
    description: 'List all KV namespaces in the account',
    path: (account: string) => `accounts/${account}/storage/kv/namespaces`,
    format: (data: { result?: Array<{ id: string; title: string }> }) =>
      (data.result ?? []).map((n) => `${n.title} (${n.id})`),
    empty: 'No KV namespaces found.',
  },
  {
    name: 'cloudflare_list_d1_databases',
    description: 'List all D1 databases in the account',
    path: (account: string) => `accounts/${account}/d1/database`,
    format: (data: { result?: Array<{ uuid: string; name: string }> }) =>
      (data.result ?? []).map((d) => `${d.name} (${d.uuid})`),
    empty: 'No D1 databases found.',
  },
  {
    name: 'cloudflare_list_r2_buckets',
    description: 'List all R2 buckets in the account',
    path: (account: string) => `accounts/${account}/r2/buckets`,
    // R2 nests its list one level deeper than the other three endpoints.
    format: (data: { result?: { buckets?: Array<{ name: string; creation_date: string }> } }) =>
      (data.result?.buckets ?? []).map((b) => `${b.name} (created: ${b.creation_date})`),
    empty: 'No R2 buckets found.',
  },
] as const;

type Tool = (typeof TOOLS)[number];

/**
 * Every tool takes the same optional account_id and defaults to the binding, so
 * the schema is shared rather than repeated per tool.
 */
const ACCOUNT_ID_SCHEMA = {
  type: 'object',
  properties: {
    account_id: {
      type: 'string',
      description: 'Cloudflare account ID (defaults to the CLOUDFLARE_ACCOUNT_ID binding)',
    },
  },
  additionalProperties: false,
} as const;

const toolDescriptors = TOOLS.map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: ACCOUNT_ID_SCHEMA,
}));

async function callTool(env: Env, tool: Tool, args: Record<string, unknown>) {
  const account =
    typeof args.account_id === 'string' && args.account_id.trim()
      ? args.account_id.trim()
      : env.CLOUDFLARE_ACCOUNT_ID;

  if (!account || !env.CLOUDFLARE_API_TOKEN) {
    return text('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN.', true);
  }

  let response: Response;
  try {
    response = await fetch(`${CF_API}/${tool.path(account)}`, {
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    });
  } catch (error) {
    return text(`Cloudflare API request failed: ${(error as Error).message}`, true);
  }

  if (!response.ok) {
    // Surface the status rather than the body: error payloads can echo account
    // identifiers, and the caller only needs to know the call was rejected.
    return text(`Cloudflare API returned HTTP ${response.status} for ${tool.name}.`, true);
  }

  const data = (await response.json()) as never;
  const lines = tool.format(data);
  return text(lines.length ? lines.join('\n') : tool.empty);
}

async function dispatch(env: Env, request: JsonRpcRequest) {
  const id = request.id ?? null;

  switch (request.method) {
    case 'initialize':
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });

    case 'ping':
      return result(id, {});

    case 'tools/list':
      return result(id, { tools: toolDescriptors });

    case 'tools/call': {
      const name = request.params?.name;
      const tool = TOOLS.find((candidate) => candidate.name === name);
      if (!tool) {
        return failure(id, METHOD_NOT_FOUND, `Unknown tool: ${String(name)}`);
      }
      const args = (request.params?.arguments as Record<string, unknown> | undefined) ?? {};
      return result(id, await callTool(env, tool, args));
    }

    default:
      return failure(id, METHOD_NOT_FOUND, `Unknown method: ${String(request.method)}`);
  }
}

mcp.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(failure(null, PARSE_ERROR, 'Request body is not valid JSON.'), 400);
  }

  // Batches are a single JSON-RPC array; notifications carry no id and get no
  // reply, so a batch of only notifications answers 202 with an empty body.
  const batch = Array.isArray(body) ? (body as JsonRpcRequest[]) : null;
  const requests = batch ?? [body as JsonRpcRequest];

  if (batch && batch.length === 0) {
    return c.json(failure(null, INVALID_REQUEST, 'Batch must not be empty.'), 400);
  }

  const responses = [];
  for (const request of requests) {
    if (!request || typeof request !== 'object' || typeof request.method !== 'string') {
      responses.push(failure(null, INVALID_REQUEST, 'Request must specify a method.'));
      continue;
    }
    // A JSON-RPC notification omits id entirely and must not be answered.
    const isNotification = !('id' in request);
    try {
      const response = await dispatch(c.env, request);
      if (!isNotification) responses.push(response);
    } catch (error) {
      if (!isNotification) {
        responses.push(failure(request.id ?? null, INTERNAL_ERROR, (error as Error).message));
      }
    }
  }

  if (responses.length === 0) return c.body(null, 202);
  return c.json(batch ? responses : responses[0]);
});

/**
 * The spec allows a server with nothing to push to decline the GET/SSE stream,
 * and this surface is request/response only.
 */
mcp.get('/', (c) => c.json({ error: 'This MCP endpoint does not offer a server-initiated stream.' }, 405));

mcp.all('/', (c) => c.json({ error: 'Method not allowed.' }, 405));

export default mcp;
