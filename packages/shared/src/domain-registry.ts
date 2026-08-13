export type DomainRole =
  | 'parent-lab'
  | 'business-hub'
  | 'institutional'
  | 'api'
  | 'gateway'
  | 'admin'
  | 'ops'
  | 'agent'
  | 'mail'
  | 'product'
  | 'personal'
  | 'legacy-fallback';

export type DomainOwnerType = 'pages' | 'worker' | 'redirect' | 'unknown';

export interface DomainRegistryEntry {
  hostname: string;
  role: DomainRole;
  repo: string;
  appOrWorker: string;
  ownerType: DomainOwnerType;
  canonical: boolean;
  notes?: string;
}

export const DOMAIN_REGISTRY: DomainRegistryEntry[] = [
  { hostname: 'goldshore.ai', role: 'parent-lab', repo: 'marzton/goldshore-ai', appOrWorker: 'gs-web', ownerType: 'pages', canonical: true },
  { hostname: 'www.goldshore.ai', role: 'parent-lab', repo: 'marzton/goldshore-ai', appOrWorker: 'redirect-rule', ownerType: 'redirect', canonical: false },
  { hostname: 'goldshore.org', role: 'business-hub', repo: 'marzton/goldshore-org', appOrWorker: 'goldshore-org', ownerType: 'pages', canonical: true, notes: 'Wix-style managed website business services hub' },
  { hostname: 'www.goldshore.org', role: 'business-hub', repo: 'marzton/goldshore-org', appOrWorker: 'redirect-rule', ownerType: 'redirect', canonical: false },
  { hostname: 'api.goldshore.ai', role: 'api', repo: 'marzton/goldshore-ai', appOrWorker: 'gs-api', ownerType: 'worker', canonical: true },
  { hostname: 'gw.goldshore.ai', role: 'gateway', repo: 'marzton/goldshore-ai', appOrWorker: 'gs-gateway', ownerType: 'worker', canonical: true },
  { hostname: 'gateway.goldshore.ai', role: 'gateway', repo: 'marzton/goldshore-ai', appOrWorker: 'gs-gateway', ownerType: 'redirect', canonical: false },
  { hostname: 'admin.goldshore.ai', role: 'admin', repo: 'marzton/goldshore-ai', appOrWorker: 'gs-web', ownerType: 'worker', canonical: true, notes: 'Cloudflare Access required; / redirects to /app/dashboard' },
  { hostname: 'admin.goldshore.org', role: 'admin', repo: 'marzton/goldshore-ai', appOrWorker: 'gs-web', ownerType: 'worker', canonical: true, notes: 'Cloudflare Access required; mirrors admin.goldshore.ai' },
  { hostname: 'ops.goldshore.ai', role: 'ops', repo: 'marzton/goldshore-ai', appOrWorker: 'gs-control', ownerType: 'worker', canonical: false, notes: 'Cloudflare Access required' },
  { hostname: 'agent.goldshore.ai', role: 'agent', repo: 'marzton/goldshore-ai', appOrWorker: 'gs-agent', ownerType: 'worker', canonical: false, notes: 'Protected endpoint' },
  { hostname: 'mail.goldshore.ai', role: 'mail', repo: 'marzton/goldshore-ai', appOrWorker: 'gs-mail', ownerType: 'worker', canonical: false },
  { hostname: 'radar.goldshore.ai', role: 'product', repo: 'marzton/goldshore-ai', appOrWorker: 'gs-web', ownerType: 'pages', canonical: false },
  { hostname: 'gearswipe.com', role: 'product', repo: 'marzton/gearswipe', appOrWorker: 'gearswipe', ownerType: 'pages', canonical: true, notes: 'Replit editor only; production is Cloudflare Pages' },
  { hostname: 'www.gearswipe.com', role: 'product', repo: 'marzton/gearswipe', appOrWorker: 'redirect-rule', ownerType: 'redirect', canonical: false, notes: '301 to https://gearswipe.com' },
  { hostname: 'rmarston.com', role: 'personal', repo: 'marzton/rmarston-com', appOrWorker: 'rmarston-com', ownerType: 'pages', canonical: true },
  { hostname: 'www.rmarston.com', role: 'personal', repo: 'marzton/rmarston-com', appOrWorker: 'redirect-rule', ownerType: 'redirect', canonical: false },
  { hostname: 'armsway.com', role: 'product', repo: 'marzton/armsway-com', appOrWorker: 'armsway-com', ownerType: 'pages', canonical: true },
  { hostname: 'www.armsway.com', role: 'product', repo: 'marzton/armsway-com', appOrWorker: 'redirect-rule', ownerType: 'redirect', canonical: false },
  { hostname: 'banproof.me', role: 'product', repo: 'marzton/banproof-me', appOrWorker: 'banproof-me', ownerType: 'unknown', canonical: true },
  { hostname: 'www.banproof.me', role: 'product', repo: 'marzton/banproof-me', appOrWorker: 'redirect-rule', ownerType: 'redirect', canonical: false },
  { hostname: 'disposable-bp-cuff-sleeves', role: 'product', repo: 'marzton/disposable-bp-cuff-sleeves', appOrWorker: 'disposable-bp-cuff-sleeves', ownerType: 'unknown', canonical: false, notes: 'Project slug until DNS is assigned' },
  { hostname: 'goldshore.github.io', role: 'legacy-fallback', repo: 'marzton/goldshore.github.io', appOrWorker: 'github-pages', ownerType: 'unknown', canonical: false, notes: 'Fallback/archive only' },
];

export const APPROVED_API_ORIGINS = [
  'https://goldshore.ai',
  'https://www.goldshore.ai',
  'https://goldshore.org',
  'https://www.goldshore.org',
  'https://admin.goldshore.ai',
  'https://admin.goldshore.org',
  'https://ops.goldshore.ai',
  'https://admin-preview.goldshore.ai',
  'https://rmarston.com',
  'https://www.rmarston.com',
  'https://armsway.com',
  'https://www.armsway.com',
  'https://gearswipe.com',
  'https://www.gearswipe.com',
  'https://banproof.me',
  'https://www.banproof.me',
] as const;

export function isApprovedApiOrigin(origin: string | null | undefined): boolean {
  return !!origin && APPROVED_API_ORIGINS.includes(origin as (typeof APPROVED_API_ORIGINS)[number]);
}
