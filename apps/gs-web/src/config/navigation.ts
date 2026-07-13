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

export const platformLinks: NavLink[] = [
  { href: '/risk-radar/', label: 'Risk Radar' },
  { href: '/platform/financial-signals/', label: 'Financial Signals' },
  { href: '/platform/workflow-engine/', label: 'Workflow Engine' },
  { href: '/platform/sentinel/', label: 'Sentinel' },
  { href: '/platform/ai-oracle/', label: 'AI Oracle' },
];

export const serviceLinks: NavLink[] = [
  { href: '/services/digital-strategy/', label: 'Digital Strategy' },
  { href: '/services/ai-implementation/', label: 'AI Implementation' },
  { href: '/services/systems-integration/', label: 'Systems Integration' },
  { href: '/services/design-dev/', label: 'Design & Development' },
  { href: '/services/consulting/', label: 'Enterprise Consulting' },
];

export const companyLinks: NavLink[] = [
  { href: '/about/', label: 'About' },
  { href: '/team/', label: 'Team' },
  { href: '/developer/', label: 'Developer Hub' },
  { href: '/status/', label: 'Status' },
  { href: '/contact/', label: 'Contact' },
];
