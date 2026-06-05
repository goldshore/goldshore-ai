import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { tradingRoutes } from './routes/trading';
import { agentRoutes } from './routes/agents';
import { getDashboardHTML } from './routes/dashboard';
import type { TradingEnv } from './types';

const app = new Hono<{ Bindings: TradingEnv }>();

app.use('*', secureHeaders());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'CF-Access-Jwt-Assertion'],
}));

app.get('/', (c) => c.html(getDashboardHTML()));
app.get('/health', (c) => c.json({ status: 'ok', service: 'gs-trading', version: '1.0.0' }));

app.route('/api/trading', tradingRoutes);
app.route('/api/agents', agentRoutes);

app.notFound((c) => c.json({ error: 'Not found', path: c.req.path }, 404));
app.onError((err, c) => {
  console.error('gs-trading error:', err);
  return c.json({ error: err.message }, 500);
});

export default { fetch: app.fetch };
