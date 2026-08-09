import type { JsonValue, StrictJsonSchema } from './types';

export interface ModelTool { name: string; description: string; parameters: StrictJsonSchema }
export interface ModelToolCall { callId: string; name: string; arguments: string }
export interface ModelResponse { id: string; text: string; toolCalls: ModelToolCall[]; raw: Record<string, unknown> }

export interface ModelProvider {
  respond(request: { model: string; input: unknown; tools: ModelTool[]; previousResponseId?: string; signal?: AbortSignal }): Promise<ModelResponse>;
}

export type OpenAISecretSource = string | { get(): Promise<string> };

/** OpenAI is an adapter, not the gateway policy layer. The key is read only at request time. */
export class OpenAIResponsesProvider implements ModelProvider {
  constructor(private readonly secret: OpenAISecretSource, private readonly endpoint = 'https://api.openai.com/v1/responses') {}

  async respond(request: { model: string; input: unknown; tools: ModelTool[]; previousResponseId?: string; signal?: AbortSignal }): Promise<ModelResponse> {
    const apiKey = typeof this.secret === 'string' ? this.secret : await this.secret.get();
    if (!apiKey) throw new Error('OPENAI_API_KEY Cloudflare secret is not configured');
    const response = await fetch(this.endpoint, {
      method: 'POST', signal: request.signal,
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        input: request.input,
        previous_response_id: request.previousResponseId,
        tools: request.tools.map((tool) => ({ type: 'function', name: tool.name, description: tool.description, parameters: tool.parameters, strict: true })),
        store: false,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI Responses API failed (${response.status})`);
    const raw = await response.json() as Record<string, unknown>;
    const output = Array.isArray(raw.output) ? raw.output as Array<Record<string, unknown>> : [];
    const toolCalls = output.filter((item) => item.type === 'function_call').map((item) => ({
      callId: String(item.call_id), name: String(item.name), arguments: String(item.arguments),
    }));
    const text = typeof raw.output_text === 'string' ? raw.output_text : output.flatMap((item) => Array.isArray(item.content) ? item.content : [])
      .filter((item): item is Record<string, JsonValue> => Boolean(item && typeof item === 'object' && (item as Record<string, unknown>).type === 'output_text'))
      .map((item) => String(item.text ?? '')).join('');
    return { id: String(raw.id), text, toolCalls, raw };
  }
}
