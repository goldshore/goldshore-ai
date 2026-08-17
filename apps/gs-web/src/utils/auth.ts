export interface JWTPayload {
  exp: number;
  iat: number;
  email?: string;
  name?: string;
  [key: string]: any;
}

export function parseJWT(token: string): JWTPayload | null {
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const decoded = JSON.parse(atob(parts[1]));
    return decoded;
  } catch {
    return null;
  }
}

export function isTokenValid(token: string): boolean {
  const payload = parseJWT(token);
  if (!payload) return false;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp > now;
}

export function getTokenExpiresIn(token: string): number | null {
  const payload = parseJWT(token);
  if (!payload) return null;

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = payload.exp - now;
  return expiresIn > 0 ? expiresIn : null;
}

export function useAuthToken(): { token: string; isValid: boolean; payload: JWTPayload | null } {
  const token = typeof document !== 'undefined'
    ? document.cookie.split('; ').find(c => c.startsWith('CF-Authorization='))?.split('=')[1] || ''
    : '';

  const payload = parseJWT(token);
  const isValid = isTokenValid(token);

  return { token, isValid, payload };
}
