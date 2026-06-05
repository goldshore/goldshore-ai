import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { verifyAccessWithClaims } from '@goldshore/auth';
import { tradingRoutes } from './routes/trading';
import { agentRoutes } from './routes/agents';
import { getDashboardHTML } from './routes/dashboard';
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
  const publicPaths = ['/', '/health'];
  if (publicPaths.includes(c.req.path) || c.req.method === 'OPTIONS') return next();
  if (c.env.ENV === 'production' && !c.env.CLOUDFLARE_ACCESS_AUDIENCE) {
    console.error('SECURITY ERROR: CLOUDFLARE_ACCESS_AUDIENCE must be set for gs-trading in production');
    return c.json({ error: 'Service auth misconfigured' }, 500);
  }
  const claims = await verifyAccessWithClaims(c.req.raw, c.env);
  if (!claims) return c.json({ error: 'Unauthorized' }, 401);
  return next();
});

app.get('/', (c) => c.html(getDashboardHTML()));
app.get('/health', (c) => c.json({ status: 'ok', service: 'gs-trading', version: '1.0.0' }));

app.route('/api/trading', tradingRoutes);
app.route('/api/agents', agentRoutes);

app.notFound((c) => c.json({ error: 'Not found', path: c.req.path }, 404));
app.onError((err, c) => {
  console.error('gs-trading error:', err);
  const message = c.env.ENV === 'production' ? 'Internal server error' : err.message;
  return c.json({ error: message }, 500);
});

export default { fetch: app.fetch };
