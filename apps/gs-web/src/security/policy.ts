import { WEB_CONTENT_SECURITY_POLICY, WEB_META_CSP } from '../utils/csp';

export const HTML_CONTENT_SECURITY_POLICY = WEB_CONTENT_SECURITY_POLICY;

// Meta CSP is only a fallback for deployments where response headers are not
// available. frame-ancestors remains header-only because browsers ignore it in
// meta CSP.
export const HTML_CSP_META_FALLBACK = WEB_META_CSP;

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
