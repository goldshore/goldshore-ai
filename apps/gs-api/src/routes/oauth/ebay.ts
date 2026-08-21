import { Hono } from 'hono';
import type { Env } from '../../types';

export const ebay = new Hono<{ Bindings: Env }>();

// eBay OAuth 2.0 (authorization code grant) for the Sell APIs used by full
// listing management: Inventory (create/edit), Account (policies), and
// Fulfillment (orders). Same shape as trading/routes/oauth.ts's Schwab flow —
// an operator-only "authorize" redirect plus a public callback that exchanges
// the code for tokens and stores them in KV. No live EBAY_CLIENT_ID/SECRET
// exist yet, so every endpoint here fails closed with a clear 503 until the
// user adds real Developer Program credentials.
const EBAY_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.marketing',
].join(' ');

const STATE_TTL = 600; // 10 minutes

function isSandbox(env: any): boolean {
  return env.EBAY_ENV === 'sandbox';
}

function authBase(env: any): string {
  return isSandbox(env) ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com';
}

function apiBase(env: any): string {
  return isSandbox(env) ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
}

/**
 * GET /oauth/ebay/authorize  (operator-only — gate at the Cloudflare Access
 * edge on /oauth/*, same as the Schwab authorize route)
 * Redirects to eBay's consent screen.
 */
ebay.get('/authorize', async (c) => {
  const clientId = c.env.EBAY_CLIENT_ID;
  // eBay calls the redirect target a "RuName" (a redirect URL name registered
  // in the Developer Program, not necessarily a literal URL) — stored the
  // same way as any other redirect_uri env var here.
  const redirectUri = c.env.EBAY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return c.json({ error: 'eBay OAuth not configured (missing EBAY_CLIENT_ID or EBAY_REDIRECT_URI)' }, 503);
  }

  const state = crypto.randomUUID();
  await c.env.KV.put(`oauth:ebay:state:${state}`, '1', { expirationTtl: STATE_TTL });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: EBAY_SCOPES,
    state,
  });

  return c.redirect(`${authBase(c.env)}/oauth2/authorize?${params.toString()}`);
});

/**
 * GET /oauth/ebay/callback?code=...&state=...  (public — eBay redirects here)
 * Exchanges the authorization code for tokens and stores them in KV.
 */
ebay.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.json({ error: `eBay authorization denied: ${c.req.query('error_description') ?? error}` }, 400);
  }
  if (!code || !state) {
    return c.json({ error: 'Missing code or state parameter from eBay callback' }, 400);
  }

  const storedState = await c.env.KV.get(`oauth:ebay:state:${state}`);
  if (!storedState) {
    return c.json({ error: 'Invalid or expired OAuth state — please try again' }, 401);
  }
  await c.env.KV.delete(`oauth:ebay:state:${state}`);

  const clientId = c.env.EBAY_CLIENT_ID;
  const clientSecret = c.env.EBAY_CLIENT_SECRET;
  const redirectUri = c.env.EBAY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return c.json({ error: 'eBay OAuth credentials not fully configured' }, 503);
  }

  // eBay's token endpoint authenticates the client via HTTP Basic auth, not
  // body params (unlike the generic google/meta/github providers in
  // ../oauth.ts) — see https://developer.ebay.com/api-docs/static/oauth-authorization-code-grant.html
  const creds = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${apiBase(c.env)}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    console.error('eBay token exchange failed:', res.status, await res.text().catch(() => ''));
    return c.json({ error: `eBay token exchange failed (${res.status}) — check server logs` }, 400);
  }

  const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number; refresh_token_expires_in?: number };

  const expiry = Date.now() + (data.expires_in - 60) * 1000;
  await Promise.all([
    c.env.KV.put('ebay:access_token', data.access_token, { expirationTtl: data.expires_in - 60 }),
    c.env.KV.put('ebay:token_expiry', String(expiry)),
    c.env.KV.put('ebay:refresh_token', data.refresh_token),
  ]);

  return c.redirect('/admin/integrations?oauth=ebay_ok');
});

/**
 * GET /oauth/ebay/status  (public — safe to expose; no secrets returned)
 */
ebay.get('/status', async (c) => {
  const [accessToken, expiry, refreshToken] = await Promise.all([
    c.env.KV.get('ebay:access_token'),
    c.env.KV.get('ebay:token_expiry'),
    c.env.KV.get('ebay:refresh_token'),
  ]);

  return c.json({
    configured: !!(c.env.EBAY_CLIENT_ID && c.env.EBAY_CLIENT_SECRET && c.env.EBAY_REDIRECT_URI),
    sandbox: isSandbox(c.env),
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    tokenExpiresAt: expiry ? new Date(parseInt(expiry)).toISOString() : null,
    authorizeUrl: c.env.EBAY_CLIENT_ID ? '/oauth/ebay/authorize' : null,
  });
});

export default ebay;
