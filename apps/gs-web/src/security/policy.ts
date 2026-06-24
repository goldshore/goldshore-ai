const HTML_CSP_DIRECTIVES = [
  "default-src 'self'",
  // WebLayout still renders inline script/style blocks, so HTML keeps the
  // minimum inline allowances needed until those blocks are externalized.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'"
] as const;

export const HTML_CONTENT_SECURITY_POLICY = HTML_CSP_DIRECTIVES.join('; ');

// Meta CSP is only a fallback for deployments where response headers are not
// available. frame-ancestors remains header-only because browsers ignore it in
// meta CSP.
export const HTML_CSP_META_FALLBACK = HTML_CSP_DIRECTIVES
  .filter((directive) => !directive.startsWith('frame-ancestors'))
  .join('; ');

// Mirrored manually in public/_headers because platform header config cannot import
// this module at runtime.
export const STATIC_RISK_RADAR_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'"
].join('; ');
