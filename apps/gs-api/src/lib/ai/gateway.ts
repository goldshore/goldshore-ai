import type { AuditSink, GatewayRequest, IdempotencyStore, JsonValue, RateLimiter, ToolDefinition } from './types';
import type { ModelProvider } from './openai-responses';
import { validateStrictJson } from './schema';

const ADMIN_MUTATE = 'ai.tools.mutate';
const SECRET_KEY = /(secret|token|password|authorization|api.?key|cookie|credential|private.?key)/i;

function containsCredential(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsCredential);
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => SECRET_KEY.test(key) || containsCredential(item));
}

export interface GatewayOptions {
  provider: ModelProvider;
  tools: readonly ToolDefinition[];
  allowedMcp: Readonly<Record<string, readonly string[]>>;
  audit: AuditSink;
  rateLimiter: RateLimiter;
  idempotency: IdempotencyStore;
  defaultModel: string;
  fallbackModel?: string;
  maxToolRounds?: number;
}

export class AIGateway {
  private readonly tools = new Map<string, ToolDefinition>();
  constructor(private readonly options: GatewayOptions) {
    for (const tool of options.tools) {
      if (this.tools.has(tool.name)) throw new Error(`Duplicate tool: ${tool.name}`);
      if (tool.mcp && !options.allowedMcp[tool.mcp.server]?.includes(tool.mcp.tool)) throw new Error(`MCP tool is not allowlisted: ${tool.mcp.server}/${tool.mcp.tool}`);
      this.tools.set(tool.name, tool);
    }
  }

  async run(request: GatewayRequest): Promise<{ responseId: string; text: string; model: string }> {
    if (!request.idempotencyKey) throw new Error('An idempotency key is required');
    await this.audit(request, 'model.request', 'allowed');
    const modelTools = [...this.tools.values()].map(({ name, description, inputSchema }) => ({ name, description, parameters: inputSchema }));
    let model = request.model ?? this.options.defaultModel;
    let response;
    try {
      response = await this.options.provider.respond({ model, input: request.input, tools: modelTools });
    } catch (cause) {
      if (!this.options.fallbackModel || model === this.options.fallbackModel) throw cause;
      model = this.options.fallbackModel;
      response = await this.options.provider.respond({ model, input: request.input, tools: modelTools });
    }
    for (let round = 0; response.toolCalls.length; round++) {
      if (round >= (this.options.maxToolRounds ?? 4)) throw new Error('Maximum tool rounds exceeded');
      const outputs = [];
      for (const call of response.toolCalls) {
        const output = await this.executeTool(request, call.name, call.callId, call.arguments);
        // Tool output is data, never instructions or policy. It returns only in the typed tool-output envelope.
        outputs.push({ type: 'function_call_output', call_id: call.callId, output: JSON.stringify(output) });
      }
      response = await this.options.provider.respond({ model, input: outputs, tools: modelTools, previousResponseId: response.id });
    }
    await this.audit(request, 'model.response', 'success', undefined, { model, responseId: response.id });
    return { responseId: response.id, text: response.text, model };
  }

  private async executeTool(request: GatewayRequest, name: string, callId: string, rawArguments: string): Promise<Record<string, JsonValue>> {
    const tool = this.tools.get(name);
    if (!tool) return this.deny(request, name, 'Tool is not registered');
    if (tool.mutates && (!request.actor.permissions.includes(ADMIN_MUTATE) || (tool.requiredPermission && !request.actor.permissions.includes(tool.requiredPermission)))) return this.deny(request, name, 'Explicit admin permission is required');
    if (tool.highImpact && (!request.approval?.approved || !request.approval.approverId)) return this.deny(request, name, 'Human approval is required');
    let parsed: unknown;
    try { parsed = JSON.parse(rawArguments); } catch { return this.deny(request, name, 'Tool arguments are not valid JSON'); }
    if (containsCredential(parsed)) return this.deny(request, name, 'Credential-shaped fields are forbidden');
    let input: Record<string, JsonValue>;
    try { input = validateStrictJson(parsed, tool.inputSchema); } catch (cause) { return this.deny(request, name, (cause as Error).message); }
    const rateKey = `${request.actor.id}:${tool.name}`;
    if (!await this.options.rateLimiter.consume(rateKey, tool.rateLimit.requests, tool.rateLimit.windowSeconds)) return this.deny(request, name, 'Tool rate limit exceeded');
    const key = `${request.actor.id}:${tool.name}:${request.idempotencyKey}:${callId}`;
    const cached = await this.options.idempotency.get(key);
    if (cached) return cached;
    await this.audit(request, 'tool.started', 'allowed', name);
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort('tool timeout');
        reject(new Error(`Tool timed out after ${tool.timeoutMs}ms`));
      }, tool.timeoutMs);
    });
    try {
      const execution = tool.execute(input, { actor: request.actor, requestId: request.requestId, idempotencyKey: key, signal: controller.signal });
      const rawOutput = await Promise.race([execution, timedOut]);
      if (containsCredential(rawOutput)) throw new Error('Credential-shaped tool output is forbidden');
      const output = validateStrictJson(rawOutput, tool.outputSchema);
      await this.options.idempotency.put(key, output, 86_400);
      await this.audit(request, 'tool.completed', 'success', name);
      return output;
    } catch (cause) {
      await this.audit(request, 'tool.failed', 'failure', name, { error: cause instanceof Error ? cause.message : 'unknown' });
      throw cause;
    } finally { clearTimeout(timeout!); }
  }

  private async deny(request: GatewayRequest, tool: string, reason: string): Promise<never> {
    await this.audit(request, 'tool.denied', 'denied', tool, { reason });
    throw new Error(`Tool denied: ${reason}`);
  }

  private audit(request: GatewayRequest, event: Parameters<AuditSink['write']>[0]['event'], outcome: Parameters<AuditSink['write']>[0]['outcome'], tool?: string, detail?: Record<string, JsonValue>) {
    return this.options.audit.write({ at: new Date().toISOString(), requestId: request.requestId, actorId: request.actor.id, event, outcome, tool, detail });
  }
}
