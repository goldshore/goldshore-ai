const PUBLIC_AI_ORIGIN = 'https://goldshore.ai';
const PUBLIC_ORG_ORIGIN = 'https://goldshore.org';

const isGoldshoreOrgHost = (hostname: string) => {
  const normalized = hostname.toLowerCase();
  return normalized === 'goldshore.org' || normalized.endsWith('.goldshore.org');
};

export const getPublicSiteOrigin = (hostname: string) =>
  isGoldshoreOrgHost(hostname) ? PUBLIC_ORG_ORIGIN : PUBLIC_AI_ORIGIN;

export const getPublicSiteUrl = (hostname: string, href = '/') =>
  new URL(href, `${getPublicSiteOrigin(hostname)}/`).toString();
