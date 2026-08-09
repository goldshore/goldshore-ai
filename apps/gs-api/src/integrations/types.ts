import type { Env } from '../types';

export type ConnectorId = 'github' | 'google' | 'cloudflare' | 'anthropic' | 'openai' | 'mailbox' | 'cms';
export type ConnectorAudience = 'admin' | 'ai';

export interface ConnectorCapability {
  operation: string;
  description: string;
  audiences: readonly ConnectorAudience[];
  requiredScopes: readonly string[];
  approvalRequired: boolean;
  input: Record<string, 'string' | 'number' | 'boolean' | 'object'>;
}

export interface AuthorizationRequest { actor: string; scopes: string[]; redirectUri?: string }
export interface AuthorizationResult { authorizationUrl?: string; grantedScopes: string[] }
export interface InvocationRequest {
  operation: string;
  input: Record<string, unknown>;
  actor: string;
  audience: ConnectorAudience;
  idempotencyKey: string;
  approvalId?: string;
}
export interface InvocationResult { status: number; data: unknown; requestId?: string }
export interface StoredToken { accessToken: string; refreshToken?: string; expiresAt?: string; scopes: string[] }

export interface ConnectorContext { env: Env; fetch?: typeof globalThis.fetch }

export interface Connector {
  readonly id: ConnectorId;
  authorize(request: AuthorizationRequest): Promise<AuthorizationResult>;
  refresh(): Promise<StoredToken>;
  discoverCapabilities(audience: ConnectorAudience): Promise<ConnectorCapability[]>;
  invoke(request: InvocationRequest): Promise<InvocationResult>;
  retry(request: InvocationRequest, attempts?: number): Promise<InvocationResult>;
  revoke(actor: string, reason: string): Promise<void>;
  audit(action: string, actor: string, metadata?: Record<string, unknown>): Promise<void>;
}
