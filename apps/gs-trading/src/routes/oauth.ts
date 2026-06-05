import { Hono } from 'hono';
import type { TradingEnv } from '../types';

export const oauthRoutes = new Hono<{ Bindings: TradingEnv }>();

const SCHWAB_AUTH_URL = 'https://api.schwabapi.com/v1/oauth/authorize';
const SCHWAB_TOKEN_URL = 'https://api.schwabapi.com/v1/oauth/token';
const STATE_TTL = 600; // 10 minutes

// ── Schwab OAuth ──────────────────────────────────────────────────────────────

/**
 * GET /oauth/schwab/authorize
 * Redirects the browser to Schwab's authorization page.
 * After the user approves, Schwab redirects to /oauth/schwab/callback.
 */
oauthRoutes.get('/schwab/authorize', async (c) => {
  if (!c.env.SCHWAB_CLIENT_ID || !c.env.SCHWAB_REDIRECT_URI) {
    return c.json({ error: 'Schwab OAuth not configured (missing SCHWAB_CLIENT_ID or SCHWAB_REDIRECT_URI)' }, 503);
  }

  // Generate a random state token and store it in KV to prevent CSRF
  const state = crypto.randomUUID();
  await c.env.TRADING_KV.put(`oauth:state:${state}`, '1', { expirationTtl: STATE_TTL });

  const params = new URLSearchParams({
    client_id: c.env.SCHWAB_CLIENT_ID,
    redirect_uri: c.env.SCHWAB_REDIRECT_URI,
    response_type: 'code',
    state,
  });

  return c.redirect(`${SCHWAB_AUTH_URL}?${params.toString()}`);
});

/**
 * GET /oauth/schwab/callback?code=...&state=...
 * Exchanges the authorization code for tokens and stores them in KV.
 * Redirects to the dashboard on success.
 */
oauthRoutes.get('/schwab/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.html(errorPage(`Schwab authorization denied: ${c.req.query('error_description') ?? error}`));
  }
  if (!code || !state) {
    return c.html(errorPage('Missing code or state parameter from Schwab callback'));
  }

  // Validate state to prevent CSRF
  const storedState = await c.env.TRADING_KV.get(`oauth:state:${state}`);
  if (!storedState) {
    return c.html(errorPage('Invalid or expired OAuth state — please try again'));
  }
  await c.env.TRADING_KV.delete(`oauth:state:${state}`);

  if (!c.env.SCHWAB_CLIENT_ID || !c.env.SCHWAB_CLIENT_SECRET || !c.env.SCHWAB_REDIRECT_URI) {
    return c.html(errorPage('Schwab OAuth credentials not fully configured'));
  }

  // Exchange authorization code for tokens
  const creds = btoa(`${c.env.SCHWAB_CLIENT_ID}:${c.env.SCHWAB_CLIENT_SECRET}`);
  const res = await fetch(SCHWAB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: c.env.SCHWAB_REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Schwab token exchange failed:', res.status, body);
    return c.html(errorPage(`Schwab token exchange failed (${res.status}) — check server logs`));
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };

  // Persist tokens in KV
  const expiry = Date.now() + (data.expires_in - 60) * 1000;
  await Promise.all([
    c.env.TRADING_KV.put('schwab:access_token', data.access_token, { expirationTtl: data.expires_in - 60 }),
    c.env.TRADING_KV.put('schwab:token_expiry', String(expiry)),
    c.env.TRADING_KV.put('schwab:refresh_token', data.refresh_token),
  ]);

  return c.redirect('/?oauth=schwab_ok');
});

// ── Robinhood token setup ─────────────────────────────────────────────────────

/**
 * POST /oauth/robinhood/token
 * Body: { token: string, accountId?: string }
 * Stores a Robinhood Bearer token in KV. Robinhood does not support
 * server-side OAuth; tokens must be obtained via their mobile/web app
 * and pasted here by the user.
 *
 * This endpoint requires Cloudflare Access (not in public paths).
 */
oauthRoutes.post('/robinhood/token', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const { token, accountId } = body;
  if (!token || typeof token !== 'string' || token.length < 20) {
    return c.json({ error: 'token (string) is required' }, 400);
  }

  await c.env.TRADING_KV.put('robinhood:token', token);
  if (accountId) await c.env.TRADING_KV.put('robinhood:account_id', accountId);

  return c.json({ success: true, message: 'Robinhood token stored in KV' });
});

/**
 * GET /oauth/status
 * Returns the current OAuth/token status for both brokers.
 */
oauthRoutes.get('/status', async (c) => {
  const [schwabAccess, schwabExpiry, schwabRefresh, rhToken] = await Promise.all([
    c.env.TRADING_KV.get('schwab:access_token'),
    c.env.TRADING_KV.get('schwab:token_expiry'),
    c.env.TRADING_KV.get('schwab:refresh_token'),
    c.env.TRADING_KV.get('robinhood:token'),
  ]);

  return c.json({
    schwab: {
      configured: !!(c.env.SCHWAB_CLIENT_ID && c.env.SCHWAB_CLIENT_SECRET),
      redirectUri: c.env.SCHWAB_REDIRECT_URI ?? null,
      hasAccessToken: !!schwabAccess,
      hasRefreshToken: !!(schwabRefresh ?? c.env.SCHWAB_REFRESH_TOKEN),
      tokenExpiresAt: schwabExpiry ? new Date(parseInt(schwabExpiry)).toISOString() : null,
      authorizeUrl: c.env.SCHWAB_CLIENT_ID ? '/oauth/schwab/authorize' : null,
    },
    robinhood: {
      configured: !!(c.env.ROBINHOOD_TOKEN ?? rhToken),
      hasToken: !!(c.env.ROBINHOOD_TOKEN ?? rhToken),
    },
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function errorPage(message: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Auth Error — GoldShore</title>
<style>body{background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:2rem;max-width:480px;text-align:center}
h1{color:#f87171;margin-top:0}a{color:#a78bfa}p{color:#94a3b8}</style></head>
<body><div class="card"><h1>Authorization Error</h1><p>${message}</p>
<p><a href="/">← Back to dashboard</a></p></div></body></html>`;
}
