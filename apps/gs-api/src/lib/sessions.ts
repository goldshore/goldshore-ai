import { randomBytes } from 'node:crypto';

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role?: string;
}

export interface Session {
  id: string;
  userId: string;
  user: SessionUser;
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const SESSION_KEY_PREFIX = 'session:';

function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

export async function createSession(
  kv: KVNamespace,
  user: SessionUser,
): Promise<Session> {
  const sessionId = generateSessionId();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;

  const session: Session = {
    id: sessionId,
    userId: user.id,
    user,
    createdAt: now,
    expiresAt,
  };

  const key = `${SESSION_KEY_PREFIX}${sessionId}`;
  await kv.put(key, JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  return session;
}

export async function getSession(
  kv: KVNamespace,
  sessionId: string,
): Promise<Session | null> {
  const key = `${SESSION_KEY_PREFIX}${sessionId}`;
  const data = await kv.get(key);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function validateSession(
  kv: KVNamespace,
  sessionId: string,
): Promise<SessionUser | null> {
  const session = await getSession(kv, sessionId);

  if (!session) {
    return null;
  }

  const now = Date.now();
  if (now > session.expiresAt) {
    await deleteSession(kv, sessionId);
    return null;
  }

  return session.user;
}

export async function deleteSession(
  kv: KVNamespace,
  sessionId: string,
): Promise<void> {
  const key = `${SESSION_KEY_PREFIX}${sessionId}`;
  await kv.delete(key);
}

export function setSessionCookie(
  response: Response,
  sessionId: string,
  secure: boolean = true,
): void {
  const cookie = [
    `gs-session=${sessionId}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];

  if (secure) {
    cookie.push('Secure');
  }

  response.headers.append('Set-Cookie', cookie.join('; '));
}

export function clearSessionCookie(response: Response): void {
  const cookie = [
    'gs-session=; Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  response.headers.append('Set-Cookie', cookie.join('; '));
}

export function getSessionIdFromCookie(request: Request): string | null {
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.match(/gs-session=([^;]+)/);
  return match ? match[1] : null;
}

export async function requireSession(
  kv: KVNamespace,
  request: Request,
): Promise<SessionUser> {
  const sessionId = getSessionIdFromCookie(request);

  if (!sessionId) {
    throw new Error('No session found');
  }

  const user = await validateSession(kv, sessionId);

  if (!user) {
    throw new Error('Invalid or expired session');
  }

  return user;
}
