import { type Env } from '../types';

export type GoldClawProviderId =
  | 'google_ads'
  | 'google_search_console'
  | 'google_analytics'
  | 'google_business_profile'
  | 'meta_business'
  | 'instagram'
  | 'x_premium'
  | 'cloudflare'
  | 'sandbox';

export type GoldClawCapability =
  | 'oauth'
  | 'read_metrics'
  | 'draft_strategy'
  | 'draft_content'
  | 'publish_requires_approval'
  | 'budget_changes_require_approval'
  | 'secure_code_execution';

export type GoldClawProviderDefinition = {
  id: GoldClawProviderId;
  label: string;
  category: 'marketing' | 'search' | 'social' | 'commerce' | 'infrastructure' | 'compute';
  goal: string;
  capabilities: GoldClawCapability[];
  requiredSecrets: string[];
  optionalSecrets?: string[];
  oauthScopes?: string[];
  firstMilestone: string;
};

export type GoldClawProviderReadiness = GoldClawProviderDefinition & {
  configuredSecrets: string[];
  missingSecrets: string[];
  ready: boolean;
};

export type GoldClawLaunchPhase = {
  dayRange: string;
  title: string;
  outcomes: string[];
};

const hasValue = (value: unknown) =>
  typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;

export const GOLDCLAW_GOOGLE_CLIENT_ID =
  '1054833139648-gt5o3k9uqhltt08nne0sigh8l3vodji7.apps.googleusercontent.com';

export const GOLDCLAW_PROVIDERS: GoldClawProviderDefinition[] = [
  {
    id: 'google_ads',
    label: 'Google Ads',
    category: 'marketing',
    goal: 'Read campaign performance, draft budget/keyword changes, and prepare monetization experiments.',
    capabilities: ['oauth', 'read_metrics', 'draft_strategy', 'budget_changes_require_approval'],
    requiredSecrets: [
      'GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_SECRET',
      'GOOGLE_ADS_DEVELOPER_TOKEN',
      'OAUTH_TOKEN_ENCRYPTION_KEY',
    ],
    optionalSecrets: ['GOOGLE_ADS_LOGIN_CUSTOMER_ID'],
    oauthScopes: ['https://www.googleapis.com/auth/adwords'],
    firstMilestone: 'Connect read-only reporting, then draft changes without applying them.',
  },
  {
    id: 'google_search_console',
    label: 'Google Search Console',
    category: 'search',
    goal: 'Analyze queries, pages, indexing issues, and SEO opportunities for goldshore.ai/org.',
    capabilities: ['oauth', 'read_metrics', 'draft_strategy'],
    requiredSecrets: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'OAUTH_TOKEN_ENCRYPTION_KEY'],
    oauthScopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    firstMilestone: 'Pull search analytics and surface high-intent SEO tasks.',
  },
  {
    id: 'google_analytics',
    label: 'Google Analytics',
    category: 'search',
    goal: 'Measure acquisition, conversions, retention, and funnel performance.',
    capabilities: ['oauth', 'read_metrics', 'draft_strategy'],
    requiredSecrets: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'OAUTH_TOKEN_ENCRYPTION_KEY'],
    optionalSecrets: ['GOOGLE_ANALYTICS_PROPERTY_ID'],
    oauthScopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    firstMilestone: 'Read traffic and conversion summaries for weekly strategy briefs.',
  },
  {
    id: 'google_business_profile',
    label: 'Google Business Profile',
    category: 'commerce',
    goal: 'Monitor local profile health, business information, posts, and reviews.',
    capabilities: ['oauth', 'read_metrics', 'draft_strategy', 'draft_content', 'publish_requires_approval'],
    requiredSecrets: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'OAUTH_TOKEN_ENCRYPTION_KEY'],
    oauthScopes: ['https://www.googleapis.com/auth/business.manage'],
    firstMilestone: 'Summarize reviews and draft response/post updates for approval.',
  },
  {
    id: 'meta_business',
    label: 'Meta Business',
    category: 'social',
    goal: 'Unify Facebook/Instagram monetization readiness, pixel health, and ad account reporting.',
    capabilities: ['oauth', 'read_metrics', 'draft_strategy', 'budget_changes_require_approval'],
    requiredSecrets: ['META_APP_ID', 'META_APP_SECRET', 'OAUTH_TOKEN_ENCRYPTION_KEY'],
    optionalSecrets: ['META_BUSINESS_ID', 'META_AD_ACCOUNT_ID', 'META_PIXEL_ID'],
    firstMilestone: 'Connect Business Manager read scopes and report audience/content gaps.',
  },
  {
    id: 'instagram',
    label: 'Instagram Professional',
    category: 'social',
    goal: 'Track follower/content thresholds and generate post/reel/story ideas for monetization.',
    capabilities: ['oauth', 'read_metrics', 'draft_strategy', 'draft_content', 'publish_requires_approval'],
    requiredSecrets: ['META_APP_ID', 'META_APP_SECRET', 'OAUTH_TOKEN_ENCRYPTION_KEY'],
    optionalSecrets: ['INSTAGRAM_BUSINESS_ACCOUNT_ID'],
    firstMilestone: 'Create a content cadence dashboard and draft posts for human approval.',
  },
  {
    id: 'x_premium',
    label: 'X Premium / Ads',
    category: 'social',
    goal: 'Track monetization eligibility, follower growth, posting cadence, and ad/reporting readiness.',
    capabilities: ['oauth', 'read_metrics', 'draft_strategy', 'draft_content', 'publish_requires_approval'],
    requiredSecrets: ['X_CLIENT_ID', 'X_CLIENT_SECRET', 'OAUTH_TOKEN_ENCRYPTION_KEY'],
    optionalSecrets: ['X_AD_ACCOUNT_ID'],
    firstMilestone: 'Read account/profile metrics and create a growth plan toward monetization thresholds.',
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare Control Plane',
    category: 'infrastructure',
    goal: 'Inspect DNS, Access, Workers, routes, and deploy health before marketing pushes.',
    capabilities: ['read_metrics', 'draft_strategy'],
    requiredSecrets: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
    optionalSecrets: ['CLOUDFLARE_ZONE_ID'],
    firstMilestone: 'Run readiness checks before campaigns and landing page launches.',
  },
  {
    id: 'sandbox',
    label: 'GoldClaw Sandbox Runtime',
    category: 'compute',
    goal: 'Run controlled experiments, report generation, web audits, and data analysis outside the Worker runtime.',
    capabilities: ['secure_code_execution', 'draft_strategy'],
    requiredSecrets: ['GOLDCLAW_SANDBOX_API_URL', 'GOLDCLAW_SANDBOX_API_TOKEN'],
    optionalSecrets: ['GOLDCLAW_SANDBOX_PROVIDER'],
    firstMilestone: 'Connect a container host with strict timeouts and network rules.',
  },
];

export const GOLDCLAW_30_DAY_PLAN: GoldClawLaunchPhase[] = [
  {
    dayRange: 'Days 1-3',
    title: 'Security and account foundation',
    outcomes: [
      'Rotate any exposed developer/API tokens and move all secrets into Cloudflare secrets or encrypted OAuth token storage.',
      'Confirm Cloudflare Access protects admin and API routes for marstonr6@gmail.com, admin@goldshore.org, and goldshorelabs@gmail.com.',
      'Connect Google OAuth in read-only mode for Search Console, Analytics, Business Profile, and Ads.',
    ],
  },
  {
    dayRange: 'Days 4-10',
    title: 'Read-only marketing intelligence',
    outcomes: [
      'Pull SEO, analytics, ads, reviews, and social metrics into GoldClaw status cards.',
      'Generate daily strategy briefs with no external writes.',
      'Create a monetization readiness checklist for Google, Meta/Instagram, and X.',
    ],
  },
  {
    dayRange: 'Days 11-20',
    title: 'Drafting and operator workflows',
    outcomes: [
      'Generate content calendars, ad experiments, SEO tasks, landing page briefs, and client offer drafts.',
      'Add approval gates for posting, campaign edits, spend changes, and profile updates.',
      'Connect sandbox/container execution for longer analysis jobs and rendered page audits.',
    ],
  },
  {
    dayRange: 'Days 21-30',
    title: 'Monetization loops',
    outcomes: [
      'Run weekly performance reviews across content, search, ads, products, and subscriptions.',
      'Prioritize revenue experiments by effort, risk, cost, and expected learning value.',
      'Ship first automated report pack for clients and internal Gold Shore Labs operations.',
    ],
  },
];

export const getGoldClawReadiness = (env: Env): GoldClawProviderReadiness[] =>
  GOLDCLAW_PROVIDERS.map((provider) => {
    const configuredSecrets = provider.requiredSecrets.filter((secret) => hasValue((env as Record<string, unknown>)[secret]));
    const missingSecrets = provider.requiredSecrets.filter((secret) => !hasValue((env as Record<string, unknown>)[secret]));

    return {
      ...provider,
      configuredSecrets,
      missingSecrets,
      ready: missingSecrets.length === 0,
    };
  });

export const buildGoldClawManifest = (env: Env) => {
  const readiness = getGoldClawReadiness(env);
  const readyCount = readiness.filter((provider) => provider.ready).length;

  return {
    name: 'GoldClaw',
    purpose:
      'Operator LLM framework for marketing, monetization, SEO, social growth, client work, and rapid product experimentation.',
    googleOAuthClientId: (env.GOOGLE_OAUTH_CLIENT_ID || GOLDCLAW_GOOGLE_CLIENT_ID).replace(/(.{16}).+(@|\.apps)/, '$1...$2'),
    mode: 'draft-first',
    safetyModel: {
      readOnlyDefault: true,
      approvalRequiredFor: ['publishing content', 'changing ad spend', 'editing campaigns', 'writing business profiles'],
      tokenStorage: 'OAuth tokens must be encrypted with OAUTH_TOKEN_ENCRYPTION_KEY before KV storage.',
    },
    readinessSummary: {
      totalProviders: readiness.length,
      readyProviders: readyCount,
      missingProviders: readiness.length - readyCount,
    },
    providers: readiness,
    plan: GOLDCLAW_30_DAY_PLAN,
  };
};

export const buildGoldClawStrategyBrief = (
  env: Env,
  objective = 'rapid monetization and useful client/service delivery',
) => {
  const readiness = getGoldClawReadiness(env);
  const ready = readiness.filter((provider) => provider.ready);
  const blocked = readiness.filter((provider) => !provider.ready);

  return {
    objective,
    generatedAt: new Date().toISOString(),
    operatingMode: 'curious analyst, cautious operator: read broadly, draft aggressively, execute only after approval',
    immediateMoves: [
      'Finish OAuth/secrets setup for Google, Meta, X, Cloudflare, and sandbox runtime.',
      'Use Google Search Console and Analytics as the first truth sources for SEO and offer demand.',
      'Use Meta/Instagram and X as content-growth loops before enabling any paid spend actions.',
      'Route all long-running analysis and browser/rendering work to a sandbox API instead of the Worker request path.',
    ],
    readyProviders: ready.map((provider) => provider.label),
    blockedProviders: blocked.map((provider) => ({
      provider: provider.label,
      missingSecrets: provider.missingSecrets,
      nextStep: provider.firstMilestone,
    })),
    approvalGates: [
      'No campaign budget edits without explicit human approval.',
      'No social posting without explicit human approval.',
      'No OAuth token plaintext in source, logs, chat, tickets, or unencrypted KV values.',
      'No arbitrary container execution without sandbox timeouts, egress policy, and audit logging.',
    ],
  };
};
