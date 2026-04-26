/**
 * Escapes HTML special characters to prevent XSS.
 * @param unsafe The string to escape.
 * @returns The escaped string.
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validates an email address format.
 * @param email The email address to validate.
 * @returns True if valid, false otherwise.
 */
export function isValidEmail(email: string): boolean {
  // Simple regex for basic validation
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Sanitizes user input by trimming whitespace and escaping HTML.
 * @param str The input string.
 * @returns The sanitized string.
 */
export function sanitizeInput(str: string): string {
  if (typeof str !== "string") return "";
  return escapeHtml(str.trim());
}

/**
 * Validates that a request originated from the same origin as the application.
 * Checks Origin, Referer, and Sec-Fetch-Site headers.
 * @param request The incoming Request object.
 * @returns True if the request is from the same origin, false otherwise.
 */
export const isSameOriginRequest = (request: Request) => {
  const expectedOrigin = new URL(request.url).origin;
  const originHeader = request.headers.get('origin');
  if (originHeader) {
    return originHeader === expectedOrigin;
  }

  const refererHeader = request.headers.get('referer');
  if (refererHeader) {
    try {
      return new URL(refererHeader).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) {
    return fetchSite === 'same-origin' || fetchSite === 'none';
  }

  return false;
};
