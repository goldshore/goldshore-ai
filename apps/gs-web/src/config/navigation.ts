export type NavLink = {
  href: string;
  label: string;
  external?: boolean;
};

export const primaryNavLinks: NavLink[] = [
  { href: '/platform/', label: 'Platform' },
  { href: '/risk-radar/', label: 'Risk Radar' },
  { href: '/services/', label: 'Services' },
  { href: '/developer/', label: 'Developer' },
  { href: '/about/', label: 'About' },
];

export const authLinks: NavLink[] = [
  { href: 'https://admin.goldshore.ai/app/dashboard', label: 'Dashboard access', external: true },
];

export const platformLinks: NavLink[] = [
  { href: '/products/', label: 'Products' },
  { href: '/risk-radar/', label: 'Risk Radar' },
  { href: '/platform/financial-signals/', label: 'Financial Signals' },
  { href: '/platform/workflow-engine/', label: 'Workflow Engine' },
  { href: '/platform/sentinel/', label: 'Sentinel' },
  { href: '/platform/ai-oracle/', label: 'AI Oracle' },
];

export const serviceLinks: NavLink[] = [
  { href: '/pricing/', label: 'Pricing' },
  { href: '/services/digital-strategy/', label: 'Digital Strategy' },
  { href: '/services/ai-implementation/', label: 'AI Implementation' },
  { href: '/services/systems-integration/', label: 'Systems Integration' },
  { href: '/services/design-dev/', label: 'Design & Development' },
  { href: '/services/consulting/', label: 'Enterprise Consulting' },
  { href: '/services/banproof/', label: 'Banproof' },
  { href: '/services/bridgekeeper/', label: 'Bridgekeeper' },
];

export const companyLinks: NavLink[] = [
  { href: '/about/', label: 'About' },
  { href: '/team/', label: 'Team' },
  { href: '/blog/', label: 'Signals' },
  { href: '/developer/', label: 'Developer Hub' },
  { href: '/status/', label: 'Status' },
  { href: '/contact/', label: 'Contact' },
];

export const adminLinks: NavLink[] = [
  { href: 'https://admin.goldshore.ai/app/dashboard', label: 'Admin Dashboard', external: true },
  { href: 'https://admin.goldshore.ai/login', label: 'Admin Login', external: true },
];

export type PublicMenuGroup = {
  label: string;
  links: NavLink[];
};

export const publicMenuGroups: PublicMenuGroup[] = [
  {
    label: 'Platform',
    links: [
      { href: '/platform/', label: 'Platform Overview' },
      ...platformLinks,
      { href: '/apps/risk-radar/', label: 'Risk Radar Live Demo' },
    ],
  },
  {
    label: 'Services',
    links: [
      { href: '/services/', label: 'Services Overview' },
      { href: '/solutions/', label: 'Solutions' },
      ...serviceLinks,
    ],
  },
  {
    label: 'Resources',
    links: [
      { href: '/developer/', label: 'Developer Hub' },
      { href: '/developer/docs/', label: 'Documentation' },
      { href: '/developer/api/', label: 'API Reference' },
      { href: '/developer/sdk/', label: 'SDK' },
      { href: '/developer/mcp/', label: 'MCP Access' },
      { href: '/features/', label: 'Features' },
      { href: '/templates/', label: 'Templates' },
      { href: '/blog/', label: 'Signals' },
      { href: '/status/', label: 'System Status' },
    ],
  },
  {
    label: 'Company',
    links: [
      { href: '/about/', label: 'About' },
      { href: '/team/', label: 'Team' },
      { href: '/contact/', label: 'Contact' },
      { href: '/intake/', label: 'Project Intake' },
      { href: '/legal/', label: 'Security & Legal' },
      { href: '/legal/privacy/', label: 'Privacy' },
      { href: '/legal/terms/', label: 'Terms' },
    ],
  },
  {
    label: 'Access',
    links: authLinks,
  },
];
