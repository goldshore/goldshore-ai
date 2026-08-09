import { Hono } from 'hono';
import type { AdminPermission } from '@goldshore/auth';
import { getActor, requirePermission } from '../auth';
import type { Env, Variables } from '../types';

const google = new Hono<{ Bindings: Env; Variables: Variables }>();
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const STATE_TTL_SECONDS = 600;
const CONNECTION_ID = 'google-business-profile';
const REDIRECT_PATH = '/admin/google/oauth/callback';
const SCOPE = 'https://www.googleapis.com/auth/business.manage';

type Tokens = { access_token: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string };
type State = { actor: string; verifier: string; redirectUri: string; createdAt: number };
type Category = 'read' | 'publish' | 'locations' | 'reviews' | 'accounts';
type Operation = { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: RegExp; permission: AdminPermission; write: boolean; origin: string; providerPath?: (path: string) => string };
const V4 = 'https://mybusiness.googleapis.com/v4/';
const ACCOUNTS_V1 = 'https://mybusinessaccountmanagement.googleapis.com/v1/';
const LOCATIONS_V1 = 'https://mybusinessbusinessinformation.googleapis.com/v1/';

const operations: Record<Category, Operation[]> = {
  read: [
    { method: 'GET', path: /^accounts\/[^/]+$/, permission: 'google-business:read', write: false, origin: ACCOUNTS_V1 },
    { method: 'GET', path: /^accounts\/[^/]+\/locations$/, permission: 'google-business:read', write: false, origin: LOCATIONS_V1 },
    { method: 'GET', path: /^accounts\/[^/]+\/locations\/[^/]+\/reviews$/, permission: 'google-business:read', write: false, origin: V4 },
  ],
  publish: [{ method: 'POST', path: /^accounts\/[^/]+\/locations\/[^/]+\/localPosts$/, permission: 'google-business:publish', write: true, origin: V4 }],
  locations: [{ method: 'PATCH', path: /^accounts\/[^/]+\/locations\/[^/]+$/, permission: 'google-business:locations:manage', write: true, origin: LOCATIONS_V1, providerPath: path => path.replace(/^accounts\/[^/]+\//, '') }],
  reviews: [{ method: 'POST', path: /^accounts\/[^/]+\/locations\/[^/]+\/reviews\/[^/]+\/reply$/, permission: 'google-business:reviews:manage', write: true, origin: V4 }],
  accounts: [{ method: 'PATCH', path: /^accounts\/[^/]+$/, permission: 'google-business:accounts:manage', write: true, origin: ACCOUNTS_V1 }],
};

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const sha256 = (value: string) => crypto.subtle.digest('SHA-256', encoder.encode(value));
const encryptionKey = async (secret: string) => crypto.subtle.importKey('raw', await sha256(secret), 'AES-GCM', false, ['encrypt', 'decrypt']);
const encrypt = async (tokens: Tokens, secret: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(secret), encoder.encode(JSON.stringify(tokens)));
  return JSON.stringify({ v: 1, alg: 'AES-GCM', iv: b64url(iv), data: b64url(new Uint8Array(data)) });
};
const decrypt = async (value: string, secret: string): Promise<Tokens> => {
  const payload = JSON.parse(value) as { iv: string; data: string };
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(payload.iv) }, await encryptionKey(secret), fromB64url(payload.data));
  return JSON.parse(decoder.decode(clear));
};
const configuredRedirect = (env: Env) => env.GOOGLE_OAUTH_REDIRECT_URI;
const allowlist = (value?: string) => new Set((value ?? '').split(',').map(v => v.trim()).filter(Boolean));
const getId = (path: string, label: 'accounts' | 'locations') => path.match(new RegExp(`(?:^|/)${label}/([^/]+)`))?.[1];

const audit = async (env: Env, item: { actor: string; account?: string; location?: string; operation: string; requestId?: string | null; result: string; status?: number; detail?: string }) => {
  await env.AUDIT_DB.prepare(`INSERT INTO google_business_audit
    (id, occurred_at, actor, target_account_id, target_location_id, operation, google_request_id, result, http_status, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), new Date().toISOString(), item.actor,
      item.account ?? null, item.location ?? null, item.operation, item.requestId ?? null, item.result, item.status ?? null, item.detail ?? null).run();
};

const saveTokens = async (env: Env, tokens: Tokens, previousRefresh?: string) => {
  if (!env.OAUTH_TOKEN_ENCRYPTION_KEY) throw new Error('Token encryption is not configured');
  const rotated = { ...tokens, refresh_token: tokens.refresh_token ?? previousRefresh };
  const now = new Date();
  const expiresAt = tokens.expires_in ? new Date(now.getTime() + tokens.expires_in * 1000).toISOString() : null;
  await env.PLATFORM_DB.prepare(`INSERT INTO google_oauth_credentials
    (connection_id, encrypted_tokens, granted_scopes, expires_at, created_at, updated_at, revoked_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(connection_id) DO UPDATE SET encrypted_tokens=excluded.encrypted_tokens,
      granted_scopes=excluded.granted_scopes, expires_at=excluded.expires_at, updated_at=excluded.updated_at, revoked_at=NULL`)
    .bind(CONNECTION_ID, await encrypt(rotated, env.OAUTH_TOKEN_ENCRYPTION_KEY), rotated.scope ?? SCOPE, expiresAt, now.toISOString(), now.toISOString()).run();
  return rotated;
};

const accessToken = async (env: Env) => {
  if (!env.OAUTH_TOKEN_ENCRYPTION_KEY || !env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) throw new Error('OAuth secrets are not configured');
  const row = await env.PLATFORM_DB.prepare('SELECT encrypted_tokens, expires_at FROM google_oauth_credentials WHERE connection_id=? AND revoked_at IS NULL').bind(CONNECTION_ID).first<{ encrypted_tokens: string; expires_at: string | null }>();
  if (!row) throw new Error('Google Business Profile is not connected');
  let tokens = await decrypt(row.encrypted_tokens, env.OAUTH_TOKEN_ENCRYPTION_KEY);
  if (row.expires_at && Date.parse(row.expires_at) > Date.now() + 60_000) return tokens.access_token;
  if (!tokens.refresh_token) throw new Error('Google refresh token is unavailable');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GOOGLE_OAUTH_CLIENT_ID, client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET, refresh_token: tokens.refresh_token, grant_type: 'refresh_token' }) });
  if (!response.ok) throw new Error('Google token refresh failed');
  tokens = await saveTokens(env, await response.json() as Tokens, tokens.refresh_token);
  return tokens.access_token;
};

google.get('/oauth/start', requirePermission('google-business:accounts:manage'), async c => {
  const redirectUri = configuredRedirect(c.env);
  if (!redirectUri || redirectUri !== new URL(REDIRECT_PATH, c.req.url).toString()) return c.json({ error: 'Configured redirect URI does not exactly match this environment.' }, 503);
  if (!c.env.GOOGLE_OAUTH_CLIENT_ID) return c.json({ error: 'Google OAuth client is not configured.' }, 503);
  const state = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = b64url(new Uint8Array(await sha256(verifier)));
  const stored: State = { actor: getActor(c.get('accessClaims'), c.req.raw), verifier, redirectUri, createdAt: Date.now() };
  await c.env.KV.put(`google-business:oauth-state:${state}`, JSON.stringify(stored), { expirationTtl: STATE_TTL_SECONDS });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for (const [key, value] of Object.entries({ client_id: c.env.GOOGLE_OAUTH_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', state, code_challenge: challenge, code_challenge_method: 'S256' })) url.searchParams.set(key, value);
  return c.req.query('format') === 'json' ? c.json({ authorizationUrl: url.toString(), redirectUri, scopes: [SCOPE] }) : c.redirect(url.toString());
});

google.get('/oauth/callback', async c => {
  const state = c.req.query('state'); const code = c.req.query('code');
  if (!state || !code) return c.json({ error: 'Missing OAuth code or state.' }, 400);
  const key = `google-business:oauth-state:${state}`;
  const stored = await c.env.KV.get<State>(key, 'json');
  await c.env.KV.delete(key);
  if (!stored || Date.now() - stored.createdAt > STATE_TTL_SECONDS * 1000) return c.json({ error: 'Invalid or expired OAuth state.' }, 400);
  if (stored.redirectUri !== configuredRedirect(c.env) || stored.redirectUri !== new URL(REDIRECT_PATH, c.req.url).toString()) return c.json({ error: 'OAuth redirect mismatch.' }, 400);
  if (!c.env.GOOGLE_OAUTH_CLIENT_ID || !c.env.GOOGLE_OAUTH_CLIENT_SECRET) return c.json({ error: 'Google OAuth secrets are not configured.' }, 503);
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: c.env.GOOGLE_OAUTH_CLIENT_ID, client_secret: c.env.GOOGLE_OAUTH_CLIENT_SECRET, redirect_uri: stored.redirectUri, grant_type: 'authorization_code', code_verifier: stored.verifier }) });
  if (!response.ok) { await audit(c.env, { actor: stored.actor, operation: 'oauth.connect', result: 'error', status: response.status }); return c.json({ error: 'Google token exchange failed.' }, 502); }
  const tokens = await response.json() as Tokens;
  if (!tokens.scope?.split(' ').includes(SCOPE)) { await audit(c.env, { actor: stored.actor, operation: 'oauth.connect', result: 'denied', detail: 'required_google_scope_not_granted' }); return c.json({ error: 'Required Google Business Profile scope was not granted.' }, 403); }
  await saveTokens(c.env, tokens);
  await audit(c.env, { actor: stored.actor, operation: 'oauth.connect', result: 'success' });
  return c.json({ connected: true });
});

google.post('/oauth/revoke', requirePermission('google-business:accounts:manage'), async c => {
  const actor = getActor(c.get('accessClaims'), c.req.raw);
  try {
    const token = await accessToken(c.env);
    const response = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }) });
    if (!response.ok) throw new Error(`Google revocation returned ${response.status}`);
    await c.env.PLATFORM_DB.prepare('UPDATE google_oauth_credentials SET encrypted_tokens=?, revoked_at=?, updated_at=? WHERE connection_id=?').bind('', new Date().toISOString(), new Date().toISOString(), CONNECTION_ID).run();
    await audit(c.env, { actor, operation: 'oauth.revoke', result: 'success', status: response.status });
    return c.json({ revoked: true });
  } catch (error) { await audit(c.env, { actor, operation: 'oauth.revoke', result: 'error', detail: String(error) }); return c.json({ error: 'Google revocation failed.' }, 502); }
});

google.get('/oauth/status', requirePermission('google-business:read'), async c => {
  const row = await c.env.PLATFORM_DB.prepare('SELECT granted_scopes, expires_at, updated_at FROM google_oauth_credentials WHERE connection_id=? AND revoked_at IS NULL').bind(CONNECTION_ID).first<{ granted_scopes: string; expires_at: string | null; updated_at: string }>();
  return c.json({ connected: Boolean(row), scopes: row?.granted_scopes.split(' ').filter(Boolean) ?? [], expiresAt: row?.expires_at ?? null, updatedAt: row?.updated_at ?? null });
});

google.post('/operations/:category', async c => {
  const category = c.req.param('category') as Category;
  const body = await c.req.json<{ method?: string; path?: string; query?: Record<string, string>; body?: unknown }>()
    .catch(() => ({} as { method?: string; path?: string; query?: Record<string, string>; body?: unknown }));
  const path = (body.path ?? '').replace(/^\/+/, ''); const method = (body.method ?? 'GET').toUpperCase();
  const operation = operations[category]?.find(item => item.method === method && item.path.test(path));
  if (!operation) return c.json({ error: 'Operation is not allowlisted for this permission category.' }, 400);
  let authorized = false;
  const deniedResponse = await requirePermission(operation.permission)(c as any, async () => { authorized = true; });
  if (!authorized) return deniedResponse ?? c.json({ error: 'Forbidden' }, 403);
  const actor = getActor(c.get('accessClaims'), c.req.raw); const account = getId(path, 'accounts'); const location = getId(path, 'locations');
  if ((account && !allowlist(c.env.GOOGLE_BUSINESS_ACCOUNT_IDS).has(account)) || (location && !allowlist(c.env.GOOGLE_BUSINESS_LOCATION_IDS).has(location))) { await audit(c.env, { actor, account, location, operation: `${method} ${path}`, result: 'denied', detail: 'target_not_authorized' }); return c.json({ error: 'Target is not authorized locally.' }, 403); }
  if (operation.write && (c.env.GOOGLE_BUSINESS_OWNERSHIP_VERIFIED !== 'true' || c.env.GOOGLE_OAUTH_PRODUCTION_APPROVED !== 'true')) { await audit(c.env, { actor, account, location, operation: `${method} ${path}`, result: 'denied', detail: 'human_verification_required' }); return c.json({ error: 'Writes require verified ownership and production OAuth consent.' }, 403); }
  try {
    const credential = await c.env.PLATFORM_DB.prepare('SELECT granted_scopes FROM google_oauth_credentials WHERE connection_id=? AND revoked_at IS NULL').bind(CONNECTION_ID).first<{ granted_scopes: string }>();
    if (!credential?.granted_scopes.split(' ').includes(SCOPE)) { await audit(c.env, { actor, account, location, operation: `${method} ${path}`, result: 'denied', detail: 'required_google_scope_not_granted' }); return c.json({ error: 'The required Google scope was not granted.' }, 403); }
    const token = await accessToken(c.env); const url = new URL(operation.providerPath?.(path) ?? path, operation.origin); Object.entries(body.query ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const response = await fetch(url, { method, headers: { authorization: `Bearer ${token}`, ...(body.body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body.body === undefined ? undefined : JSON.stringify(body.body) });
    const requestId = response.headers.get('x-request-id') ?? response.headers.get('x-guploader-uploadid');
    await audit(c.env, { actor, account, location, operation: `${method} ${path}`, requestId, result: response.ok ? 'success' : 'error', status: response.status });
    return new Response(response.body, { status: response.status, headers: { 'content-type': response.headers.get('content-type') ?? 'application/json', ...(requestId ? { 'x-google-request-id': requestId } : {}) } });
  } catch (error) { await audit(c.env, { actor, account, location, operation: `${method} ${path}`, result: 'error', detail: String(error) }); return c.json({ error: 'Google operation failed.' }, 502); }
});

export default google;
