import { Hono } from 'hono';
import { SchwabClient } from '../brokers/schwab';
import { RobinhoodClient } from '../brokers/robinhood';
import { checkOrderRisk, getPortfolioRiskMetrics } from '../agents/riskAgent';
import type { TradingEnv, BrokerName } from '../types';

export const tradingRoutes = new Hono<{ Bindings: TradingEnv }>();

const DEMO_MODE_KEY = 'demo';
const isDemoMode = (env: TradingEnv) =>
  !env.SCHWAB_CLIENT_ID && !env.ROBINHOOD_TOKEN;

tradingRoutes.get('/accounts', async (c) => {
  if (isDemoMode(c.env)) return c.json({ accounts: getMockAccounts(), demo: true });
  const results: any[] = [];
  const errors: any[] = [];
  if (c.env.SCHWAB_CLIENT_ID) {
    try { results.push(await new SchwabClient(c.env).getAccount()); }
    catch (e: any) { errors.push({ broker: 'schwab', error: e.message }); }
  }
  if (c.env.ROBINHOOD_TOKEN) {
    try { results.push(await new RobinhoodClient(c.env).getAccount()); }
    catch (e: any) { errors.push({ broker: 'robinhood', error: e.message }); }
  }
  return c.json({ accounts: results.flat(), errors });
});

tradingRoutes.get('/positions', async (c) => {
  if (isDemoMode(c.env)) return c.json({ positions: getMockPositions(), demo: true });
  const broker = c.req.query('broker') as BrokerName | undefined;
  const positions: any[] = [];
  const errors: any[] = [];
  if (!broker || broker === 'schwab') {
    if (c.env.SCHWAB_CLIENT_ID) {
      try { positions.push(...await new SchwabClient(c.env).getPositions()); }
      catch (e: any) { errors.push({ broker: 'schwab', error: e.message }); }
    }
  }
  if (!broker || broker === 'robinhood') {
    if (c.env.ROBINHOOD_TOKEN) {
      try { positions.push(...await new RobinhoodClient(c.env).getPositions()); }
      catch (e: any) { errors.push({ broker: 'robinhood', error: e.message }); }
    }
  }
  return c.json({ positions, errors });
});

tradingRoutes.get('/orders', async (c) => {
  if (isDemoMode(c.env)) return c.json({ orders: getMockOrders(), demo: true });
  const broker = c.req.query('broker') as BrokerName | undefined;
  const orders: any[] = [];
  const errors: any[] = [];
  if (!broker || broker === 'schwab') {
    if (c.env.SCHWAB_CLIENT_ID) {
      try { orders.push(...await new SchwabClient(c.env).getOrders()); }
      catch (e: any) { errors.push({ broker: 'schwab', error: e.message }); }
    }
  }
  if (!broker || broker === 'robinhood') {
    if (c.env.ROBINHOOD_TOKEN) {
      try { orders.push(...await new RobinhoodClient(c.env).getOrders()); }
      catch (e: any) { errors.push({ broker: 'robinhood', error: e.message }); }
    }
  }
  return c.json({ orders, errors });
});

tradingRoutes.get('/quotes', async (c) => {
  const symbolsRaw = c.req.query('symbols') ?? 'SPY,QQQ,AAPL,TSLA,NVDA';
  const symbols = symbolsRaw.split(',').map(s => s.trim()).filter(Boolean);
  const broker = c.req.query('broker') as BrokerName | undefined;

  // In demo mode return mock quotes clearly labeled as such
  if (isDemoMode(c.env)) return c.json({ quotes: getMockQuotes(symbols), demo: true });

  // Live mode: attempt the configured broker and propagate errors — never silently substitute mock data
  if ((!broker || broker === 'schwab') && c.env.SCHWAB_CLIENT_ID) {
    const quotes = await new SchwabClient(c.env).getQuotes(symbols);
    return c.json({ quotes });
  }
  if ((!broker || broker === 'robinhood') && c.env.ROBINHOOD_TOKEN) {
    const quotes = await new RobinhoodClient(c.env).getQuotes(symbols);
    return c.json({ quotes });
  }
  return c.json({ error: 'No broker configured for quotes' }, 503);
});

tradingRoutes.post('/orders', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const { broker, symbol, side, quantity, orderType, limitPrice } = body;
  if (!broker || !symbol || !side || !quantity || !orderType) {
    return c.json({ error: 'Missing required fields: broker, symbol, side, quantity, orderType' }, 400);
  }

  // Fetch live account + position data to run risk checks before order placement
  const accounts: any[] = [];
  const positions: any[] = [];
  try {
    if (broker === 'schwab' && c.env.SCHWAB_CLIENT_ID) {
      const client = new SchwabClient(c.env);
      const [acct, pos] = await Promise.all([client.getAccount(), client.getPositions()]);
      accounts.push(acct);
      positions.push(...pos);
    } else if (broker === 'robinhood' && c.env.ROBINHOOD_TOKEN) {
      const client = new RobinhoodClient(c.env);
      const [acct, pos] = await Promise.all([client.getAccount(), client.getPositions()]);
      accounts.push(acct);
      positions.push(...pos);
    }
  } catch (e: any) {
    return c.json({ error: `Failed to fetch account data for risk check: ${e.message}` }, 503);
  }

  // Estimate order value for risk check (use limitPrice if provided, else last known price)
  const estimatedPrice = limitPrice ?? 0;
  const estimatedValue = estimatedPrice * Number(quantity);

  const riskCheck = checkOrderRisk(
    { symbol, side, quantity: Number(quantity), estimatedValue },
    accounts,
    positions,
    {
      maxPositionSizePct: 0.05,
      maxDrawdownPct: 0.10,
      maxDailyLossPct: 0.02,
      maxConcentrationPct: 0.15,
      allowedAssetTypes: ['EQUITY', 'ETF'],
    }
  );

  if (!riskCheck.passed) {
    return c.json({ error: 'Order blocked by risk manager', violations: riskCheck.violations, warnings: riskCheck.warnings }, 422);
  }

  try {
    if (broker === 'schwab') {
      if (!c.env.SCHWAB_CLIENT_ID) return c.json({ error: 'Schwab not configured' }, 400);
      const result = await new SchwabClient(c.env).placeOrder({ symbol, side, quantity, orderType, limitPrice });
      return c.json({ success: true, ...result, broker, warnings: riskCheck.warnings });
    }
    if (broker === 'robinhood') {
      return c.json({ error: 'Robinhood order placement requires instrument URL resolution' }, 400);
    }
    return c.json({ error: 'Unknown broker' }, 400);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

tradingRoutes.delete('/orders/:id', async (c) => {
  const id = c.req.param('id');
  const broker = c.req.query('broker') as BrokerName;
  try {
    if (broker === 'schwab') await new SchwabClient(c.env).cancelOrder(id);
    else if (broker === 'robinhood') await new RobinhoodClient(c.env).cancelOrder(id);
    return c.json({ success: true, orderId: id });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

tradingRoutes.get('/risk', async (c) => {
  if (isDemoMode(c.env)) return c.json({ metrics: getMockRiskMetrics(), demo: true });
  const accounts: any[] = [];
  const positions: any[] = [];
  try {
    if (c.env.SCHWAB_CLIENT_ID) {
      const s = new SchwabClient(c.env);
      accounts.push(await s.getAccount());
      positions.push(...await s.getPositions());
    }
    if (c.env.ROBINHOOD_TOKEN) {
      const r = new RobinhoodClient(c.env);
      accounts.push(await r.getAccount());
      positions.push(...await r.getPositions());
    }
  } catch {}
  return c.json({ metrics: getPortfolioRiskMetrics(positions, accounts) });
});

tradingRoutes.post('/risk/check', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const check = checkOrderRisk(
    body.order,
    body.accounts ?? [],
    body.positions ?? [],
    body.config ?? { maxPositionSizePct: 0.05, maxDrawdownPct: 0.10, maxDailyLossPct: 0.02, maxConcentrationPct: 0.15, allowedAssetTypes: ['EQUITY', 'ETF'] }
  );
  return c.json(check);
});

// --- Mock data (demo mode only — never returned when broker credentials are set) ---
function getMockAccounts() {
  return [
    { broker: 'schwab', accountId: '****1234', totalValue: 125430.50, cashBalance: 12500.00, buyingPower: 25000.00, dayPL: 834.22, dayPLPct: 0.67, totalPL: 23450.75 },
    { broker: 'robinhood', accountId: '****5678', totalValue: 18750.25, cashBalance: 2200.00, buyingPower: 4400.00, dayPL: -142.30, dayPLPct: -0.75, totalPL: 3210.40 },
  ];
}
function getMockPositions() {
  return [
    { symbol: 'SPY', quantity: 50, avgCost: 445.20, currentPrice: 461.85, marketValue: 23092.50, unrealizedPL: 832.50, unrealizedPLPct: 3.74, broker: 'schwab', assetType: 'ETF' },
    { symbol: 'AAPL', quantity: 100, avgCost: 172.30, currentPrice: 189.45, marketValue: 18945.00, unrealizedPL: 1715.00, unrealizedPLPct: 9.95, broker: 'schwab', assetType: 'EQUITY' },
    { symbol: 'NVDA', quantity: 30, avgCost: 620.00, currentPrice: 875.40, marketValue: 26262.00, unrealizedPL: 7662.00, unrealizedPLPct: 41.19, broker: 'schwab', assetType: 'EQUITY' },
    { symbol: 'TSLA', quantity: 25, avgCost: 245.10, currentPrice: 231.80, marketValue: 5795.00, unrealizedPL: -332.50, unrealizedPLPct: -5.43, broker: 'robinhood', assetType: 'EQUITY' },
    { symbol: 'QQQ', quantity: 20, avgCost: 380.50, currentPrice: 402.30, marketValue: 8046.00, unrealizedPL: 436.00, unrealizedPLPct: 5.72, broker: 'robinhood', assetType: 'ETF' },
  ];
}
function getMockOrders() {
  const now = new Date().toISOString();
  return [
    { id: 'ord-001', broker: 'schwab', symbol: 'AAPL', side: 'BUY', quantity: 10, orderType: 'LIMIT', limitPrice: 187.50, status: 'OPEN', filledQuantity: 0, placedAt: now, updatedAt: now },
    { id: 'ord-002', broker: 'robinhood', symbol: 'TSLA', side: 'SELL', quantity: 5, orderType: 'MARKET', status: 'FILLED', filledQuantity: 5, filledPrice: 232.10, placedAt: now, updatedAt: now },
    { id: 'ord-003', broker: 'schwab', symbol: 'SPY', side: 'BUY', quantity: 10, orderType: 'LIMIT', limitPrice: 458.00, status: 'CANCELLED', filledQuantity: 0, placedAt: now, updatedAt: now },
  ];
}
function getMockQuotes(symbols: string[]) {
  const prices: Record<string, number> = { SPY: 461.85, QQQ: 402.30, AAPL: 189.45, TSLA: 231.80, NVDA: 875.40, MSFT: 415.20, AMZN: 185.60 };
  return symbols.map(s => ({
    symbol: s, bid: (prices[s] ?? 100) - 0.05, ask: (prices[s] ?? 100) + 0.05,
    last: prices[s] ?? 100, change: 0, changePct: 0,
    volume: 0, high: 0, low: 0, open: 0, close: prices[s] ?? 100,
  }));
}
function getMockRiskMetrics() {
  return {
    totalValue: 144180.75, totalDayPL: 691.92, totalDayPLPct: 0.48,
    top5Concentration: 0.82, equityExposure: 106040.75, optionExposure: 0,
    cashPct: 0.102, concentrations: [
      { symbol: 'NVDA', value: 26262, pct: 0.182 },
      { symbol: 'SPY', value: 23092.5, pct: 0.160 },
      { symbol: 'AAPL', value: 18945, pct: 0.131 },
      { symbol: 'QQQ', value: 8046, pct: 0.056 },
      { symbol: 'TSLA', value: 5795, pct: 0.040 },
    ],
  };
}
