import { WEB_META_CSP } from '../utils/csp';

// Fallback CSP used only when the edge/platform response header is unavailable.
// Keep this aligned with the browser-safe meta policy because frame-ancestors is
// ignored in meta tags and remains enforced by response headers.
export const HTML_CSP_META_FALLBACK = WEB_META_CSP;
