import { Hono } from 'hono';
import { tradingRoutes } from '../trading/routes/trading';
import { agentRoutes } from '../trading/routes/agents';
import { oauthRoutes } from '../trading/routes/oauth';
import { paperRoutes } from '../trading/routes/paper';
import { getDashboardHTML } from '../trading/routes/dashboard';
import { isEnabled, setFlag, FLAGS } from '../trading/flags';

const trading = new Hono();
const tradingEnv = (env: any) => ({ ...env, TRADING_KV: env.TRADING_KV ?? env.KV, PAPER_DB: env.PAPER_DB ?? env.PLATFORM_DB });
const withTradingEnv = async (c: any, next: any) => {
  c.env = tradingEnv(c.env);
  return next();
};
const defaultTradingOn = (env: any) => (!env.SCHWAB_CLIENT_ID && !env.ROBINHOOD_TOKEN) || env.ENV !== 'production';
const requireFlag = async (c: any, next: any) => {
  const enabled = await isEnabled(tradingEnv(c.env), FLAGS.MCP_TRADING, defaultTradingOn(c.env));
  if (!enabled) return c.json({ error: 'mcp-trading feature is currently disabled', flag: FLAGS.MCP_TRADING }, 503);
  return next();
};

trading.use('*', withTradingEnv);
trading.get('/', (c) => c.html(getDashboardHTML()));
trading.get('/health', (c) => c.json({ status: 'ok', service: 'gs-api-trading', migratedFrom: 'gs-trading-prod' }));
trading.get('/api/flags', async (c) => c.json({ flags: { [FLAGS.MCP_TRADING]: await isEnabled(tradingEnv(c.env), FLAGS.MCP_TRADING, defaultTradingOn(c.env)) } }));
trading.post('/api/flags/:key', async (c) => {
  const key = c.req.param('key');
  if (key !== FLAGS.MCP_TRADING) return c.json({ error: 'Unknown flag' }, 400);
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (typeof body.enabled !== 'boolean') return c.json({ error: 'body.enabled (boolean) is required' }, 400);
  await setFlag(tradingEnv(c.env), key, body.enabled);
  return c.json({ flag: key, enabled: body.enabled });
});
trading.use('/api/trading/*', requireFlag);
trading.use('/api/agents/*', requireFlag);
trading.use('/paper/*', requireFlag);
trading.route('/oauth', oauthRoutes as any);
trading.route('/api/trading', tradingRoutes as any);
trading.route('/api/agents', agentRoutes as any);
trading.route('/paper', paperRoutes as any);

export default trading;
