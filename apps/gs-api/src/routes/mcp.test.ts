import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mcp from './mcp';
import type { Env } from '../types';

const env = { CF_ACCOUNT_ID: 'acct123', CF_TOKEN: 'tok' } as unknown as Env;

const rpc = (body: unknown, bindings: Env = env) =>
  mcp.request(
    '/',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    bindings,
  );

/** Each Cloudflare list endpoint has a different result shape; R2 nests one level deeper. */
const cloudflareStub = () =>
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const url = String(input);
    const result = url.includes('/workers/scripts')
      ? [{ id: 'gs-api', modified_on: '2026-08-13' }]
      : url.includes('/r2/buckets')
        ? { buckets: [{ name: 'gs-assets', creation_date: '2026-01-01' }] }
        : url.includes('/d1/database')
          ? [{ uuid: 'u1', name: 'PLATFORM_DB' }]
          : [{ id: 'k1', title: 'GS_API_KV' }];
    return new Response(JSON.stringify({ result }), { status: 200 });
  });

afterEach(() => mock.restoreAll());

describe('mcp route', () => {
  it('initialize reports the protocol version, tools capability, and server identity', async () => {
    const body = (await (await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize' })).json()) as any;
    assert.equal(body.result.protocolVersion, '2025-06-18');
    assert.ok(body.result.capabilities.tools);
    assert.equal(body.result.serverInfo.name, 'goldshore-mcp');
  });

  it('tools/list advertises Cloudflare inventory and GoldShore knowledge tools with object schemas', async () => {
    const body = (await (await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).json()) as any;
    assert.deepEqual(
      body.result.tools.map((t: { name: string }) => t.name).sort(),
      [
        'cloudflare_list_d1_databases',
        'cloudflare_list_kv_namespaces',
        'cloudflare_list_r2_buckets',
        'cloudflare_list_workers',
        'goldshore_search_knowledge',
      ],
    );
    assert.ok(body.result.tools.every((t: { inputSchema: { type: string } }) => t.inputSchema.type === 'object'));
  });

  it('searches indexed GoldShore knowledge through the configured AI Search endpoint', async () => {
    const stub = mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
      success: true,
      result: { chunks: [{ text: 'gs-api owns email.', score: 0.91, item: { key: 'architecture.md' } }] },
    }), { status: 200 }));
    const body = (await (await rpc({ jsonrpc: '2.0', id: 12, method: 'tools/call', params: {
      name: 'goldshore_search_knowledge', arguments: { query: 'Who owns email?' },
    } })).json()) as any;
    assert.match(body.result.content[0].text, /gs-api owns email/);
    assert.match(String(stub.mock.calls[0].arguments[0]), /search\.ai\.cloudflare\.com\/search/);
  });

  for (const [name, expected] of [
    ['cloudflare_list_workers', 'gs-api'],
    ['cloudflare_list_kv_namespaces', 'GS_API_KV'],
    ['cloudflare_list_d1_databases', 'PLATFORM_DB'],
    ['cloudflare_list_r2_buckets', 'gs-assets'],
  ] as const) {
    it(`tools/call ${name} formats the Cloudflare response`, async () => {
      cloudflareStub();
      const body = (await (
        await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name, arguments: {} } })
      ).json()) as any;
      assert.match(body.result.content[0].text, new RegExp(expected));
    });
  }

  it('falls back to the CLOUDFLARE_ACCOUNT_ID binding when no account_id is supplied', async () => {
    const stub = cloudflareStub();
    await rpc({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'cloudflare_list_workers', arguments: {} },
    });
    assert.match(String(stub.mock.calls[0].arguments[0]), /accounts\/acct123\//);
  });

  it('prefers an explicit account_id argument over the binding', async () => {
    const stub = cloudflareStub();
    await rpc({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'cloudflare_list_workers', arguments: { account_id: 'override' } },
    });
    assert.match(String(stub.mock.calls[0].arguments[0]), /accounts\/override\//);
  });

  it('returns -32601 for an unknown tool and an unknown method', async () => {
    const tool = (await (
      await rpc({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'nope' } })
    ).json()) as any;
    assert.equal(tool.error.code, -32601);

    const method = (await (await rpc({ jsonrpc: '2.0', id: 7, method: 'nope' })).json()) as any;
    assert.equal(method.error.code, -32601);
  });

  it('answers a notification with 202 and no body', async () => {
    const response = await rpc({ jsonrpc: '2.0', method: 'ping' });
    assert.equal(response.status, 202);
    assert.equal(await response.text(), '');
  });

  it('answers a batch with an array of the same length', async () => {
    const body = (await (
      await rpc([
        { jsonrpc: '2.0', id: 8, method: 'ping' },
        { jsonrpc: '2.0', id: 9, method: 'tools/list' },
      ])
    ).json()) as any;
    assert.equal(body.length, 2);
  });

  it('rejects malformed JSON with 400 and -32700', async () => {
    const response = await mcp.request(
      '/',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' },
      env,
    );
    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as any).error.code, -32700);
  });

  it('reports missing credentials as a tool error rather than throwing', async () => {
    const body = (await (
      await rpc(
        { jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'cloudflare_list_workers', arguments: {} } },
        {} as Env,
      )
    ).json()) as any;
    assert.equal(body.result.isError, true);
    assert.match(body.result.content[0].text, /CF_ACCOUNT_ID/);
  });

  it('surfaces a Cloudflare API failure status without echoing the response body', async () => {
    mock.method(globalThis, 'fetch', async () => new Response('account 123 secret detail', { status: 403 }));
    const body = (await (
      await rpc({ jsonrpc: '2.0', id: 11, method: 'tools/call', params: { name: 'cloudflare_list_workers', arguments: {} } })
    ).json()) as any;
    assert.equal(body.result.isError, true);
    assert.match(body.result.content[0].text, /403/);
    assert.doesNotMatch(body.result.content[0].text, /secret detail/);
  });

  it('declines the server-initiated stream with 405', async () => {
    assert.equal((await mcp.request('/', { method: 'GET' }, env)).status, 405);
  });
});
