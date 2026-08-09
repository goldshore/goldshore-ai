import assert from 'node:assert/strict';
import test from 'node:test';
import { AIGateway, type AuditRecord, type ModelProvider, type ToolDefinition } from '../lib/ai/index';

const schema = {
  type: 'object', properties: { value: { type: 'string', maxLength: 20 } }, required: ['value'], additionalProperties: false,
} as const;

const stores = () => {
  const audit: AuditRecord[] = [];
  const cache = new Map<string, Record<string, import('../lib/ai/index').JsonValue>>();
  return {
    audit,
    options: {
      audit: { write: async (record: AuditRecord) => { audit.push(record); } },
      rateLimiter: { consume: async () => true },
      idempotency: {
        get: async (key: string) => cache.get(key) ?? null,
        put: async (key: string, value: Record<string, import('../lib/ai/index').JsonValue>) => { cache.set(key, value); },
      },
    },
  };
};

const tool = (overrides: Partial<ToolDefinition> = {}): ToolDefinition => ({
  name: 'echo', description: 'Echo validated text', inputSchema: schema, outputSchema: schema,
  timeoutMs: 100, rateLimit: { requests: 2, windowSeconds: 60 }, mutates: false, highImpact: false,
  execute: async (input) => ({ value: input.value }), ...overrides,
});

function provider(argumentsJson = '{"value":"safe"}'): ModelProvider {
  let calls = 0;
  return { respond: async () => ++calls === 1
    ? { id: 'r1', text: '', toolCalls: [{ callId: 'c1', name: 'echo', arguments: argumentsJson }], raw: {} }
    : { id: 'r2', text: 'done', toolCalls: [], raw: {} } };
}

const request = {
  actor: { id: 'admin-1', permissions: [] }, input: 'echo safe', requestId: 'req-1', idempotencyKey: 'idem-1',
};

test('executes validated read-only tools and audits the flow', async () => {
  const state = stores();
  const gateway = new AIGateway({ provider: provider(), tools: [tool()], allowedMcp: {}, defaultModel: 'test-model', ...state.options });
  assert.deepEqual(await gateway.run(request), { responseId: 'r2', text: 'done', model: 'test-model' });
  assert.deepEqual(state.audit.map((entry) => entry.event), ['model.request', 'tool.started', 'tool.completed', 'model.response']);
});

test('rejects additional input fields and records a denial', async () => {
  const state = stores();
  const gateway = new AIGateway({ provider: provider('{"value":"safe","role":"admin"}'), tools: [tool()], allowedMcp: {}, defaultModel: 'test-model', ...state.options });
  await assert.rejects(gateway.run(request), /additional property/);
  assert.equal(state.audit.at(-1)?.event, 'tool.denied');
});

test('requires explicit admin permission and human approval for a high-impact mutation', async () => {
  const state = stores();
  const gateway = new AIGateway({ provider: provider(), tools: [tool({ mutates: true, highImpact: true, requiredPermission: 'sites.publish' })], allowedMcp: {}, defaultModel: 'test-model', ...state.options });
  await assert.rejects(gateway.run(request), /Explicit admin permission/);
  const permitted = { ...request, actor: { id: 'admin-1', permissions: ['ai.tools.mutate', 'sites.publish'] } };
  const freshGateway = new AIGateway({ provider: provider(), tools: [tool({ mutates: true, highImpact: true, requiredPermission: 'sites.publish' })], allowedMcp: {}, defaultModel: 'test-model', ...state.options });
  await assert.rejects(freshGateway.run(permitted), /Human approval/);
});

test('refuses tools outside the exact MCP allowlist', () => {
  const state = stores();
  assert.throws(() => new AIGateway({ provider: provider(), tools: [tool({ mcp: { server: 'cms', tool: 'publish' } })], allowedMcp: {}, defaultModel: 'test-model', ...state.options }), /not allowlisted/);
});

test('rejects credential-shaped model arguments', async () => {
  const state = stores();
  const gateway = new AIGateway({ provider: provider('{"value":"safe","api_key":"do-not-forward"}'), tools: [tool()], allowedMcp: {}, defaultModel: 'test-model', ...state.options });
  await assert.rejects(gateway.run(request), /Credential-shaped/);
});
