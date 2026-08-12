export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface StrictJsonSchema {
  type: 'object';
  properties: Record<string, JsonPropertySchema>;
  required: string[];
  additionalProperties: false;
}

export type JsonPropertySchema =
  | { type: 'string'; enum?: string[]; minLength?: number; maxLength?: number; pattern?: string }
  | { type: 'number' | 'integer'; minimum?: number; maximum?: number }
  | { type: 'boolean' }
  | { type: 'array'; items: JsonPropertySchema; maxItems?: number }
  | StrictJsonSchema;

export interface Actor {
  id: string;
  permissions: readonly string[];
}

export interface ToolContext {
  actor: Actor;
  requestId: string;
  idempotencyKey: string;
  signal: AbortSignal;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: StrictJsonSchema;
  outputSchema: StrictJsonSchema;
  timeoutMs: number;
  rateLimit: { requests: number; windowSeconds: number };
  mutates: boolean;
  highImpact: boolean;
  requiredPermission?: string;
  mcp?: { server: string; tool: string };
  execute(input: Record<string, JsonValue>, context: ToolContext): Promise<Record<string, JsonValue>>;
}

export interface Approval {
  approved: boolean;
  approverId?: string;
  reason?: string;
}

export interface GatewayRequest {
  actor: Actor;
  input: string;
  requestId: string;
  idempotencyKey: string;
  model?: string;
  approval?: Approval;
  metadata?: Record<string, string>;
}

export interface AuditRecord {
  at: string;
  requestId: string;
  actorId: string;
  event: 'model.request' | 'model.response' | 'tool.denied' | 'tool.started' | 'tool.completed' | 'tool.failed';
  tool?: string;
  outcome: 'allowed' | 'denied' | 'success' | 'failure';
  detail?: Record<string, JsonValue>;
}

export interface AuditSink { write(record: AuditRecord): Promise<void> }
export interface RateLimiter { consume(key: string, limit: number, windowSeconds: number): Promise<boolean> }
export interface IdempotencyStore {
  get(key: string): Promise<Record<string, JsonValue> | null>;
  put(key: string, value: Record<string, JsonValue>, ttlSeconds: number): Promise<void>;
}
