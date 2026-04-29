export const analyticsProviders = [
  {
    name: 'GA4',
    host: 'analytics.google.com',
    status: 'enabled',
    measurementId: 'G-XXXXXXX',
    scriptPlacement: 'Global head',
    notes: 'Primary analytics provider',
  },
];

export const adPlacements = [
  {
    name: 'Hero Banner',
    status: 'active',
    inventory: 'Homepage',
    refresh: '60s refresh',
    sizes: '728x90, 970x250',
    notes: 'Top-of-page placement',
  },
];

export const affiliateLinks = [
  {
    partner: 'Cloudflare',
    status: 'active',
    program: 'Partner Network',
    trackingTag: 'gs-edge',
    defaultUrl: 'https://www.cloudflare.com/',
    payout: 'Rev share',
  },
];

export const pageMonetizationConfigs = [
  {
    page: '/',
    analyticsEnabled: true,
    analyticsPlacement: 'Global head',
    adsEnabled: true,
    adPlacement: 'Hero Banner',
    affiliateSlot: 'Primary CTA card',
    notes: 'Baseline configuration',
  },
];
