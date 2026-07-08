import { Hono } from 'hono';
import { getActor, logAdminAction, requirePermission } from '../auth';
import { buildGoldClawManifest, buildGoldClawStrategyBrief, GOLDCLAW_GOOGLE_CLIENT_ID } from '../lib/GoldClaw';
import { type Env, type Variables } from '../types';

const goldclaw = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

type OAuthTokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

const textEncoder = new TextEncoder();

const base64UrlEncode = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const getEncryptionKey = async (rawKey: string) => {
  const material = await crypto.subtle.digest('SHA-256', textEncoder.encode(rawKey));
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']);
};

const encryptJson = async (payload: Record<string, unknown>, rawKey: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey(rawKey);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(JSON.stringify(payload)),
  );

  return {
    v: 1,
    alg: 'AES-GCM',
    iv: base64UrlEncode(iv),
    data: base64UrlEncode(new Uint8Array(encrypted)),
  };
};

const buildGoogleRedirectUri = (requestUrl: string, env: Env) =>
  env.GOOGLE_OAUTH_REDIRECT_URI ||
  new URL('/goldclaw/oauth/google/callback', requestUrl).toString();

const getGoogleScopes = () => [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/business.manage',
];

goldclaw.get('/', requirePermission('system:read'), async (c) => {
  return c.json({ success: true, data: buildGoldClawManifest(c.env) });
});

goldclaw.get('/readiness', requirePermission('system:read'), async (c) => {
  return c.json({ success: true, data: buildGoldClawManifest(c.env).providers });
});

goldclaw.get('/plan', requirePermission('system:read'), async (c) => {
  return c.json({ success: true, data: buildGoldClawManifest(c.env).plan });
});

goldclaw.post('/brief', requirePermission('system:read'), async (c) => {
  const payload = await c.req.json<{ objective?: string }>().catch(() => ({}));
  const brief = buildGoldClawStrategyBrief(c.env, payload.objective);

  await logAdminAction(c.env, {
    action: 'goldclaw.strategy.brief',
    actor: getActor(c.get('accessClaims'), c.req.raw),
    status: 'success',
    metadata: { objective: payload.objective ?? null },
  });

  return c.json({ success: true, data: brief });
});

goldclaw.get('/oauth/google/start', requirePermission('system:write'), async (c) => {
  const clientId = c.env.GOOGLE_OAUTH_CLIENT_ID || GOLDCLAW_GOOGLE_CLIENT_ID;
  const redirectUri = buildGoogleRedirectUri(c.req.url, c.env);
  const state = crypto.randomUUID();
  const next = c.req.query('next') || '/admin/goldclaw';
  const scopes = getGoogleScopes();

  await c.env.KV.put(
    `goldclaw:oauth:state:${state}`,
    JSON.stringify({
      provider: 'google',
      actor: getActor(c.get('accessClaims'), c.req.raw),
      next,
      createdAt: new Date().toISOString(),
    }),
    { expirationTtl: 10 * 60 },
  );

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('include_granted_scopes', 'true');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  if (c.req.query('format') === 'json') {
    return c.json({
      success: true,
      data: {
        provider: 'google',
        authUrl: authUrl.toString(),
        redirectUri,
        scopes,
      },
    });
  }

  return c.redirect(authUrl.toString(), 302);
});

goldclaw.get('/oauth/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.json({ error: 'Missing OAuth code or state.' }, 400);
  }

  const storedState = await c.env.KV.get(`goldclaw:oauth:state:${state}`, 'json');
  if (!storedState) {
    return c.json({ error: 'Invalid or expired OAuth state.' }, 400);
  }

  if (!c.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return c.json({ error: 'GOOGLE_OAUTH_CLIENT_SECRET is not configured.' }, 503);
  }

  if (!c.env.OAUTH_TOKEN_ENCRYPTION_KEY) {
    return c.json({ error: 'OAUTH_TOKEN_ENCRYPTION_KEY is not configured.' }, 503);
  }

  const clientId = c.env.GOOGLE_OAUTH_CLIENT_ID || GOLDCLAW_GOOGLE_CLIENT_ID;
  const redirectUri = buildGoogleRedirectUri(c.req.url, c.env);
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: c.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    return c.json({ error: 'Google token exchange failed.' }, 502);
  }

  const tokenPayload = (await tokenResponse.json()) as OAuthTokenPayload;
  const encrypted = await encryptJson(
    {
      provider: 'google',
      tokenPayload,
      storedAt: new Date().toISOString(),
      actor: (storedState as { actor?: string }).actor ?? 'unknown',
      scopes: tokenPayload.scope?.split(' ') ?? getGoogleScopes(),
    },
    c.env.OAUTH_TOKEN_ENCRYPTION_KEY,
  );

  await c.env.KV.put('goldclaw:oauth:google', JSON.stringify(encrypted));
  await c.env.KV.delete(`goldclaw:oauth:state:${state}`);

  await logAdminAction(c.env, {
    action: 'goldclaw.oauth.google.connected',
    actor: (storedState as { actor?: string }).actor ?? 'unknown',
    status: 'success',
    metadata: {
      scopes: tokenPayload.scope?.split(' ') ?? [],
      hasRefreshToken: Boolean(tokenPayload.refresh_token),
    },
  });

  const next = (storedState as { next?: string }).next || '/admin/goldclaw';
  return c.redirect(next, 302);
});

goldclaw.get('/oauth/status', requirePermission('system:read'), async (c) => {
  const googleToken = await c.env.KV.get('goldclaw:oauth:google', 'json');

  return c.json({
    success: true,
    data: {
      google: {
        connected: Boolean(googleToken),
        encrypted: Boolean(googleToken),
      },
    },
  });
});

export { encryptJson };
export default goldclaw;
