import type { ConnectorCapability, ConnectorId } from './types';

export interface ConnectorDefinition {
  id: ConnectorId;
  credentialBindings: readonly string[];
  scopeAllowlist: readonly string[];
  hostAllowlist: readonly string[];
  capabilities: readonly ConnectorCapability[];
}

const read = (operation: string, description: string, scopes: string[], input: ConnectorCapability['input'] = {}): ConnectorCapability =>
  ({ operation, description, audiences: ['admin', 'ai'], requiredScopes: scopes, approvalRequired: false, input });
const write = (operation: string, description: string, scopes: string[], input: ConnectorCapability['input']): ConnectorCapability =>
  ({ operation, description, audiences: ['admin'], requiredScopes: scopes, approvalRequired: true, input });

export const CONNECTOR_DEFINITIONS: Record<ConnectorId, ConnectorDefinition> = {
  github: {
    id: 'github', credentialBindings: ['CONNECTOR_GITHUB_CLIENT_ID', 'CONNECTOR_GITHUB_CLIENT_SECRET', 'CONNECTOR_GITHUB_TOKEN'],
    scopeAllowlist: ['read:user', 'repo:status', 'contents:read', 'pull_requests:read', 'contents:write', 'deployments:write'],
    hostAllowlist: ['api.github.com', 'github.com'], capabilities: [
      read('repositories.list', 'List approved repositories.', ['contents:read'], { owner: 'string' }),
      read('pull_requests.get', 'Read pull-request metadata.', ['pull_requests:read'], { owner: 'string', repo: 'string', number: 'number' }),
      write('deployments.create', 'Create a deployment after approval.', ['deployments:write'], { owner: 'string', repo: 'string', ref: 'string' }),
    ],
  },
  google: {
    id: 'google', credentialBindings: ['CONNECTOR_GOOGLE_CLIENT_ID', 'CONNECTOR_GOOGLE_CLIENT_SECRET'],
    scopeAllowlist: ['openid', 'email', 'https://www.googleapis.com/auth/webmasters.readonly', 'https://www.googleapis.com/auth/analytics.readonly'],
    hostAllowlist: ['accounts.google.com', 'oauth2.googleapis.com', 'www.googleapis.com'], capabilities: [
      read('search_console.query', 'Query Search Console metrics.', ['https://www.googleapis.com/auth/webmasters.readonly'], { siteUrl: 'string', query: 'object' }),
      read('analytics.report', 'Read Analytics reports.', ['https://www.googleapis.com/auth/analytics.readonly'], { property: 'string', report: 'object' }),
    ],
  },
  cloudflare: {
    id: 'cloudflare', credentialBindings: ['CONNECTOR_CLOUDFLARE_API_TOKEN', 'CONNECTOR_CLOUDFLARE_ACCOUNT_ID'],
    scopeAllowlist: ['account:read', 'workers:read', 'workers:write', 'dns:read', 'dns:write', 'secrets:write'],
    hostAllowlist: ['api.cloudflare.com'], capabilities: [
      read('workers.list', 'List Workers.', ['workers:read']), read('dns.list', 'List DNS records.', ['dns:read'], { zoneId: 'string' }),
      write('workers.deploy', 'Deploy an approved Worker artifact.', ['workers:write'], { scriptName: 'string', artifactRef: 'string' }),
      write('dns.update', 'Change a DNS record.', ['dns:write'], { zoneId: 'string', recordId: 'string', record: 'object' }),
      write('secrets.put', 'Change a Worker secret.', ['secrets:write'], { scriptName: 'string', secretName: 'string', secretRef: 'string' }),
    ],
  },
  anthropic: {
    id: 'anthropic', credentialBindings: ['CONNECTOR_ANTHROPIC_API_KEY'], scopeAllowlist: ['messages:create'],
    hostAllowlist: ['api.anthropic.com'], capabilities: [read('messages.create', 'Create a bounded model response.', ['messages:create'], { model: 'string', messages: 'object' })],
  },
  openai: {
    id: 'openai', credentialBindings: ['CONNECTOR_OPENAI_API_KEY'], scopeAllowlist: ['responses:write', 'models:read'],
    hostAllowlist: ['api.openai.com'], capabilities: [read('models.list', 'List available models.', ['models:read']), read('responses.create', 'Create a bounded model response.', ['responses:write'], { model: 'string', input: 'object' })],
  },
  mailbox: {
    id: 'mailbox', credentialBindings: ['CONNECTOR_MAILBOX_API_TOKEN', 'CONNECTOR_MAILBOX_ACCOUNT_ID'], scopeAllowlist: ['mail:read', 'mail:send'],
    hostAllowlist: ['api.mailchannels.net'], capabilities: [read('messages.list', 'List mailbox message metadata.', ['mail:read']), write('messages.send', 'Send mail after explicit approval.', ['mail:send'], { to: 'string', subject: 'string', body: 'string' })],
  },
  cms: {
    id: 'cms', credentialBindings: ['CONNECTOR_CMS_API_TOKEN', 'CONNECTOR_CMS_ORIGIN'], scopeAllowlist: ['content:read', 'content:write', 'subscribers:delete', 'permissions:write'],
    hostAllowlist: ['api.goldshore.ai'], capabilities: [read('content.list', 'List CMS content.', ['content:read']), write('content.publish', 'Publish content after approval.', ['content:write'], { contentId: 'string' }), write('subscribers.delete', 'Delete a subscriber after approval.', ['subscribers:delete'], { subscriberId: 'string' }), write('permissions.update', 'Change CMS permissions.', ['permissions:write'], { subjectId: 'string', permissions: 'object' })],
  },
};

export const getCapability = (id: ConnectorId, operation: string) => CONNECTOR_DEFINITIONS[id].capabilities.find((item) => item.operation === operation);
