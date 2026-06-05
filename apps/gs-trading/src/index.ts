import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { verifyAccessWithClaims } from '@goldshore/auth';
import { tradingRoutes } from './routes/trading';
import { agentRoutes } from './routes/agents';
import { getDashboardHTML } from './routes/dashboard';
import { isEnabled, setFlag, FLAGS } from './flags';
import type { TradingEnv } from './types';

const ALLOWED_ORIGINS = [
  'https://trading.goldshore.ai',
  'https://admin.goldshore.ai',
  'https://goldshore.ai',
];

const app = new Hono<{ Bindings: TradingEnv }>();

app.use('*', secureHeaders());
app.use('*', cors({
  origin: (origin, c) => {
    if (c.env.ENV !== 'production' && origin &&
      (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
      return origin;
    }
    return ALLOWED_ORIGINS.includes(origin ?? '') ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'CF-Access-Jwt-Assertion'],
  credentials: true,
}));

// Cloudflare Access JWT guard — dashboard and health are public, all API routes are protected.
app.use('*', async (c, next) => {
  const publicPaths = ['/', '/health', '/api/flags'];
  if (publicPaths.includes(c.req.path) || c.req.method === 'OPTIONS') return next();
  if (c.env.ENV === 'production' && !c.env.CLOUDFLARE_ACCESS_AUDIENCE) {
    console.error('SECURITY ERROR: CLOUDFLARE_ACCESS_AUDIENCE must be set for gs-trading in production');
    return c.json({ error: 'Service auth misconfigured' }, 500);
  }
  const claims = await verifyAccessWithClaims(c.req.raw, c.env);
  if (!claims) return c.json({ error: 'Unauthorized' }, 401);
  return next();
});

// mcp-trading feature flag guard — blocks trading + agent routes when disabled.
// In demo/dev mode (no broker secrets) the flag defaults to enabled so local dev works.
app.use('/api/trading/*', async (c, next) => {
  const isDev = !c.env.SCHWAB_CLIENT_ID && !c.env.ROBINHOOD_TOKEN;
  const enabled = await isEnabled(c.env, FLAGS.MCP_TRADING, /* default */ isDev || c.env.ENV !== 'production');
  if (!enabled) return c.json({ error: 'mcp-trading feature is currently disabled', flag: FLAGS.MCP_TRADING }, 503);
  return next();
});

app.use('/api/agents/*', async (c, next) => {
  const isDev = !c.env.SCHWAB_CLIENT_ID && !c.env.ROBINHOOD_TOKEN;
  const enabled = await isEnabled(c.env, FLAGS.MCP_TRADING, isDev || c.env.ENV !== 'production');
  if (!enabled) return c.json({ error: 'mcp-trading feature is currently disabled', flag: FLAGS.MCP_TRADING }, 503);
  return next();
});

app.get('/', (c) => c.html(getDashboardHTML()));
app.get('/health', (c) => c.json({ status: 'ok', service: 'gs-trading', version: '1.0.0' }));

// Flag inspection + management endpoint (auth-protected in production via the guard above)
app.get('/api/flags', async (c) => {
  const enabled = await isEnabled(c.env, FLAGS.MCP_TRADING, true);
  return c.json({ flags: { [FLAGS.MCP_TRADING]: enabled } });
});

app.post('/api/flags/:key', async (c) => {
  const key = c.req.param('key');
  if (key !== FLAGS.MCP_TRADING) return c.json({ error: 'Unknown flag' }, 400);
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (typeof body.enabled !== 'boolean') return c.json({ error: 'body.enabled (boolean) is required' }, 400);
  await setFlag(c.env, key, body.enabled);
  return c.json({ flag: key, enabled: body.enabled });
});

app.route('/api/trading', tradingRoutes);
app.route('/api/agents', agentRoutes);

app.notFound((c) => c.json({ error: 'Not found', path: c.req.path }, 404));
app.onError((err, c) => {
  console.error('gs-trading error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default { fetch: app.fetch };
