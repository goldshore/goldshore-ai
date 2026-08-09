import { logAdminAction } from '../auth';
import { CONNECTOR_DEFINITIONS, getCapability } from './catalog';
import { assertNoPromptInjection, assertSafeUrl, readBoundedJson, validateInput } from './security';
import type { AuthorizationRequest, AuthorizationResult, Connector, ConnectorContext, ConnectorId, InvocationRequest, InvocationResult, StoredToken } from './types';

type RequestPlan = { url: string; method?: string; body?: unknown };
type RequestPlanner = (operation: string, input: Record<string, unknown>) => RequestPlan;

const planners: Record<ConnectorId, RequestPlanner> = {
  github: (op, input) => op === 'repositories.list' ? { url: `https://api.github.com/users/${encodeURIComponent(String(input.owner))}/repos` } : op === 'pull_requests.get' ? { url: `https://api.github.com/repos/${encodeURIComponent(String(input.owner))}/${encodeURIComponent(String(input.repo))}/pulls/${Number(input.number)}` } : { url: `https://api.github.com/repos/${encodeURIComponent(String(input.owner))}/${encodeURIComponent(String(input.repo))}/deployments`, method: 'POST', body: { ref: input.ref } },
  google: (op, input) => op === 'search_console.query' ? { url: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(String(input.siteUrl))}/searchAnalytics/query`, method: 'POST', body: input.query } : { url: `https://www.googleapis.com/v1beta/properties/${encodeURIComponent(String(input.property))}:runReport`, method: 'POST', body: input.report },
  cloudflare: (op, input) => op === 'workers.list' ? { url: 'https://api.cloudflare.com/client/v4/accounts' } : op === 'dns.list' ? { url: `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(String(input.zoneId))}/dns_records` } : op === 'dns.update' ? { url: `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(String(input.zoneId))}/dns_records/${encodeURIComponent(String(input.recordId))}`, method: 'PUT', body: input.record } : op === 'secrets.put' ? { url: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(String(input.accountId || 'configured'))}/workers/scripts/${encodeURIComponent(String(input.scriptName))}/secrets`, method: 'PUT', body: { name: input.secretName, secretRef: input.secretRef } } : { url: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(String(input.accountId || 'configured'))}/workers/scripts/${encodeURIComponent(String(input.scriptName))}`, method: 'PUT', body: { artifactRef: input.artifactRef } },
  anthropic: (_op, input) => ({ url: 'https://api.anthropic.com/v1/messages', method: 'POST', body: input }),
  openai: (op, input) => op === 'models.list' ? { url: 'https://api.openai.com/v1/models' } : { url: 'https://api.openai.com/v1/responses', method: 'POST', body: input },
  mailbox: (op, input) => op === 'messages.list' ? { url: 'https://api.mailchannels.net/tx/v1/messages' } : { url: 'https://api.mailchannels.net/tx/v1/send', method: 'POST', body: input },
  cms: (op, input) => op === 'content.list' ? { url: 'https://api.goldshore.ai/pages' } : op === 'content.publish' ? { url: `https://api.goldshore.ai/pages/${encodeURIComponent(String(input.contentId))}/status`, method: 'PATCH', body: { status: 'published' } } : op === 'subscribers.delete' ? { url: `https://api.goldshore.ai/subscribers/${encodeURIComponent(String(input.subscriberId))}`, method: 'DELETE' } : { url: `https://api.goldshore.ai/admin/subjects/${encodeURIComponent(String(input.subjectId))}/permissions`, method: 'PUT', body: input.permissions },
};

export class HttpConnector implements Connector {
  readonly id: ConnectorId;
  constructor(id: ConnectorId, private readonly context: ConnectorContext) { this.id = id; }

  async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    const definition = CONNECTOR_DEFINITIONS[this.id];
    const denied = request.scopes.filter((scope) => !definition.scopeAllowlist.includes(scope));
    if (denied.length) throw new Error(`Scopes not allowlisted: ${denied.join(', ')}`);
    await this.audit('connector.authorization.requested', request.actor, { scopes: request.scopes });
    return { grantedScopes: request.scopes };
  }
  async refresh(): Promise<StoredToken> { throw new Error(`Token refresh requires an installed ${this.id} authorization adapter`); }
  async discoverCapabilities(audience: 'admin' | 'ai') { return CONNECTOR_DEFINITIONS[this.id].capabilities.filter((capability) => capability.audiences.includes(audience)); }

  async invoke(request: InvocationRequest): Promise<InvocationResult> {
    const definition = CONNECTOR_DEFINITIONS[this.id];
    const capability = getCapability(this.id, request.operation);
    if (!capability || !capability.audiences.includes(request.audience)) throw new Error('Connector operation is not exposed to this audience');
    if (await this.context.env.KV.get(`connector:revoked:${this.id}`)) throw new Error('Connector is emergency-revoked');
    if (capability.approvalRequired && !request.approvalId) throw new Error('Connector operation requires approval');
    validateInput(request.input, capability.input); assertNoPromptInjection(request.input);
    const plan = planners[this.id](request.operation, request.input); assertSafeUrl(plan.url, definition.hostAllowlist);
    const response = await (this.context.fetch || fetch)(plan.url, { method: plan.method || 'GET', redirect: 'error', headers: { 'Content-Type': 'application/json', 'X-Goldshore-Idempotency-Key': request.idempotencyKey }, body: plan.body === undefined ? undefined : JSON.stringify(plan.body) });
    const data = await readBoundedJson(response);
    if (!response.ok) throw new Error(`Connector upstream returned ${response.status}`);
    await this.audit('connector.invoked', request.actor, { operation: request.operation, audience: request.audience, approvalId: request.approvalId });
    return { status: response.status, data, requestId: response.headers.get('x-request-id') || undefined };
  }
  async retry(request: InvocationRequest, attempts = 3): Promise<InvocationResult> {
    let last: unknown; for (let attempt = 0; attempt < Math.min(Math.max(attempts, 1), 3); attempt++) { try { return await this.invoke(request); } catch (error) { last = error; if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt)); } } throw last;
  }
  async revoke(actor: string, reason: string): Promise<void> { await this.context.env.KV.put(`connector:revoked:${this.id}`, JSON.stringify({ actor, reason, at: new Date().toISOString() })); await this.audit('connector.emergency_revoked', actor, { reason }); }
  async audit(action: string, actor: string, metadata: Record<string, unknown> = {}): Promise<void> { await logAdminAction(this.context.env, { action, actor, status: 'success', metadata: { connector: this.id, ...metadata } }); }
}

export const createConnector = (id: ConnectorId, context: ConnectorContext): Connector => new HttpConnector(id, context);
