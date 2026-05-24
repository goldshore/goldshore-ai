export function serializeCsp(directives: ContentSecurityPolicyDirectives): string {
  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

const SELF = "'self'";
const UNSAFE_INLINE = "'unsafe-inline'";
const NONE = "'none'";

type ContentSecurityPolicyDirectives = Record<string, readonly string[]>;

export const GOLDSHORE_API_ORIGINS = [
  'https://api.goldshore.ai',
  'https://api-preview.goldshore.ai',
] as const;

export const WEB_CONNECT_SRC = [SELF, ...GOLDSHORE_API_ORIGINS] as const;
export const BROWSER_CONNECT_SRC = WEB_CONNECT_SRC;

export const WEB_CSP_DIRECTIVES = {
  'default-src': [SELF],
  'script-src': [SELF, UNSAFE_INLINE, 'https://*.cloudflare.com'],
  'style-src': [
    SELF,
    UNSAFE_INLINE,
    'https://fonts.googleapis.com',
    'https://unpkg.com',
  ],
  'font-src': [SELF, 'https://fonts.gstatic.com'],
  'img-src': [SELF, 'data:', 'https://*.cloudflare.com'],
  'connect-src': [...BROWSER_CONNECT_SRC],
  'object-src': [NONE],
  'base-uri': [SELF],
} as const satisfies ContentSecurityPolicyDirectives;

const WEB_META_DIRECTIVES = {
  ...WEB_CSP_DIRECTIVES,
} as const satisfies ContentSecurityPolicyDirectives;

const WEB_HEADER_DIRECTIVES = {
  ...WEB_CSP_DIRECTIVES,
  'frame-ancestors': [NONE],
} as const satisfies ContentSecurityPolicyDirectives;

const serializeCsp = (directives: ContentSecurityPolicyDirectives): string =>
  Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ');

export function buildContentSecurityPolicy(
  directives: ContentSecurityPolicyDirectives = WEB_CSP_DIRECTIVES,
): string {
  return serializeCsp(directives);
}

export const WEB_META_CSP = buildContentSecurityPolicy(WEB_META_DIRECTIVES);
export const WEB_HEADERS_CSP = buildContentSecurityPolicy(WEB_HEADER_DIRECTIVES);
export const WEB_CONTENT_SECURITY_POLICY = WEB_HEADERS_CSP;
