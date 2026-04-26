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
