export type IntegrationDefinition = {
  id: string;
  name: string;
  baseUrl: string;
  authMethod: string;
  scopes: string[];
  rateLimits: string;
  dataClassification: string;
};

export const integrations: IntegrationDefinition[] = [
  {
    id: 'cloudflare-api',
    name: 'Cloudflare API (Zones, Workers, Access, DNS)',
    baseUrl: 'https://api.cloudflare.com/client/v4',
    authMethod: 'API token (bearer)',
    scopes: [
      'Zone:Read',
      'Zone:Edit',
      'Workers:Read',
      'Workers:Edit',
      'Access:Read',
      'Access:Edit',
      'DNS:Read',
      'DNS:Edit',
    ],
    rateLimits: 'Global API limit (typically 1,200 requests / 5 min / user; endpoint-specific caps apply).',
    dataClassification: 'Confidential (infrastructure metadata, DNS records, access policies).',
  },
  {
    id: 'google-api',
    name: 'Google APIs',
    baseUrl: 'https://www.googleapis.com',
    authMethod: 'OAuth 2.0 (user or service account) or API key for public endpoints',
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    rateLimits: 'Project- and API-specific quotas (varies by API; enforced in Google Cloud Console).',
    dataClassification: 'Confidential (workspace, project, and identity metadata).',
  },
  {
    id: 'gemini-api',
    name: 'Google Gemini API',
    baseUrl: 'https://generativelanguage.googleapis.com',
    authMethod: 'API key (Google AI Studio) or OAuth 2.0 (Vertex AI)',
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform (Vertex AI)',
    ],
    rateLimits: 'Model- and project-specific quotas (see Google AI Studio or Vertex AI quotas).',
    dataClassification: 'Confidential (prompt and completion content).',
  },
  {
    id: 'thinkorswim-api',
    name: 'ThinkorSwim API',
    baseUrl: 'https://api.tdameritrade.com/v1',
    authMethod: 'OAuth 2.0 (authorization code + refresh token)',
    scopes: [
      'Account:Read',
      'Account:Trade',
      'MarketData:Read',
    ],
    rateLimits: 'Typically ~120 requests/minute per user; subject to broker throttling.',
    dataClassification: 'Restricted (brokerage credentials, account and trading data).',
  },
  {
    id: 'openai-api',
    name: 'OpenAI / ChatGPT API',
    baseUrl: 'https://api.openai.com/v1',
    authMethod: 'API key (bearer)',
    scopes: [
      'Project API key (model access scoped by project)',
    ],
    rateLimits: 'Per-model and per-project rate limits (configured in OpenAI dashboard).',
    dataClassification: 'Confidential (prompt, completion, and usage telemetry).',
  },
  {
    id: 'jules-api',
    name: 'Jules API',
    baseUrl: 'https://api.goldshore.ai/jules',
    authMethod: 'OAuth 2.0 (internal service-to-service tokens)',
    scopes: [
      'jules:read',
      'jules:write',
      'automation:run',
    ],
    rateLimits: 'Internal gateway limits (align with automation workload SLOs).',
    dataClassification: 'Confidential (automation runs, internal workflows, and task metadata).',
  },
];
