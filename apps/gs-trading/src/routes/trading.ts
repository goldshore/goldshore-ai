import { Hono } from 'hono';
import { SchwabClient } from '../brokers/schwab';
import { RobinhoodClient } from '../brokers/robinhood';
import { checkOrderRisk, getPortfolioRiskMetrics } from '../agents/riskAgent';
import type { TradingEnv, BrokerName } from '../types';

export const tradingRoutes = new Hono<{ Bindings: TradingEnv }>();

const isDemoMode = (env: TradingEnv) => !env.SCHWAB_CLIENT_ID && !env.ROBINHOOD_TOKEN;

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
  if (isDemoMode(c.env)) return c.json({ quotes: getMockQuotes(symbols), demo: true });
  // Propagate errors — never silently substitute mock data in live mode
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

  const { broker, symbol, side, orderType, limitPrice, estimatedPrice: bodyEstimatedPrice } = body;
  const quantity = Number(body.quantity);

  if (!broker || !symbol || !side || !quantity || !orderType) {
    return c.json({ error: 'Missing required fields: broker, symbol, side, quantity, orderType' }, 400);
  }
  if (!['BUY', 'SELL'].includes(side)) return c.json({ error: 'side must be BUY or SELL' }, 400);
  if (!['schwab', 'robinhood'].includes(broker)) return c.json({ error: 'broker must be schwab or robinhood' }, 400);
  if (quantity <= 0 || !Number.isFinite(quantity)) return c.json({ error: 'quantity must be a positive number' }, 400);

  // Schwab only supports MARKET and LIMIT order types
  const schwabOrderTypes = ['MARKET', 'LIMIT'] as const;
  if (broker === 'schwab' && !schwabOrderTypes.includes(orderType)) {
    return c.json({ error: `Schwab does not support order type '${orderType}'. Supported: MARKET, LIMIT` }, 400);
  }
  if (orderType === 'LIMIT' && (!limitPrice || !Number.isFinite(Number(limitPrice)) || Number(limitPrice) <= 0)) {
    return c.json({ error: 'limitPrice must be a positive number for LIMIT orders' }, 400);
  }
  // MARKET orders require an estimated price to perform meaningful risk checks
  if (orderType !== 'LIMIT') {
    const ep = Number(bodyEstimatedPrice);
    if (!bodyEstimatedPrice || !Number.isFinite(ep) || ep <= 0) {
      return c.json({ error: 'estimatedPrice is required for MARKET orders to perform risk checks (provide the current market price)' }, 400);
    }
  }

  // Fetch live account + position data for risk checks before placement
  const accounts: any[] = [];
  const positions: any[] = [];
  if (!isDemoMode(c.env)) {
    try {
      if (broker === 'schwab' && c.env.SCHWAB_CLIENT_ID) {
        const client = new SchwabClient(c.env);
        const [acct, pos] = await Promise.all([client.getAccount(), client.getPositions()]);
        accounts.push(acct); positions.push(...pos);
      } else if (broker === 'robinhood' && c.env.ROBINHOOD_TOKEN) {
        const client = new RobinhoodClient(c.env);
        const [acct, pos] = await Promise.all([client.getAccount(), client.getPositions()]);
        accounts.push(acct); positions.push(...pos);
      }
    } catch (e: any) {
      return c.json({ error: `Failed to fetch account data for risk check: ${e.message}` }, 503);
    }
  }

  const estimatedPrice = orderType === 'LIMIT' ? Number(limitPrice) : Number(bodyEstimatedPrice);
  const riskCheck = checkOrderRisk(
    { symbol, side, quantity, estimatedValue: estimatedPrice * quantity },
    accounts, positions,
    { maxPositionSizePct: 0.05, maxDrawdownPct: 0.10, maxDailyLossPct: 0.02, maxConcentrationPct: 0.15, allowedAssetTypes: ['EQUITY', 'ETF'] }
  );
  if (!riskCheck.passed) {
    return c.json({ error: 'Order blocked by risk manager', violations: riskCheck.violations, warnings: riskCheck.warnings }, 422);
  }

  if (isDemoMode(c.env)) {
    return c.json({ success: true, orderId: `demo-${Date.now()}`, broker, warnings: riskCheck.warnings, demo: true });
  }

  try {
    if (broker === 'schwab') {
      const result = await new SchwabClient(c.env).placeOrder({ symbol, side, quantity, orderType, limitPrice: Number(limitPrice) });
      return c.json({ success: true, ...result, broker, warnings: riskCheck.warnings });
    }
    return c.json({ error: 'Robinhood order placement requires instrument URL resolution' }, 400);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

tradingRoutes.delete('/orders/:id', async (c) => {
  const id = c.req.param('id');
  const broker = c.req.query('broker') as BrokerName | undefined;
  if (!broker || !['schwab', 'robinhood'].includes(broker)) {
    return c.json({ error: 'broker query param is required (schwab | robinhood)' }, 400);
  }
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
  const errors: any[] = [];
  if (c.env.SCHWAB_CLIENT_ID) {
    try {
      const s = new SchwabClient(c.env);
      accounts.push(await s.getAccount());
      positions.push(...await s.getPositions());
    } catch (e: any) { errors.push({ broker: 'schwab', error: e.message }); }
  }
  if (c.env.ROBINHOOD_TOKEN) {
    try {
      const r = new RobinhoodClient(c.env);
      accounts.push(await r.getAccount());
      positions.push(...await r.getPositions());
    } catch (e: any) { errors.push({ broker: 'robinhood', error: e.message }); }
  }
  return c.json({ metrics: getPortfolioRiskMetrics(positions, accounts), ...(errors.length ? { errors } : {}) });
});

tradingRoutes.post('/risk/check', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const { order, accounts, positions, config } = body;
  if (!order || typeof order !== 'object') return c.json({ error: 'order is required' }, 400);
  if (typeof order.estimatedValue !== 'number') return c.json({ error: 'order.estimatedValue (number) is required' }, 400);
  const check = checkOrderRisk(
    order,
    accounts ?? [],
    positions ?? [],
    config ?? { maxPositionSizePct: 0.05, maxDrawdownPct: 0.10, maxDailyLossPct: 0.02, maxConcentrationPct: 0.15, allowedAssetTypes: ['EQUITY', 'ETF'] }
  );
  return c.json(check);
});

// Token status endpoint — lets the dashboard show broker auth health
tradingRoutes.get('/auth/status', async (c) => {
  const status: Record<string, any> = {};
  if (c.env.SCHWAB_CLIENT_ID) {
    try { status.schwab = await new SchwabClient(c.env).getTokenStatus(); }
    catch (e: any) { status.schwab = { error: e.message }; }
  } else {
    status.schwab = { configured: false };
  }
  status.robinhood = { configured: !!c.env.ROBINHOOD_TOKEN };
  status.demoMode = isDemoMode(c.env);
  return c.json(status);
});

// --- Mock data (demo mode only) ---
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
  return symbols.map(s => ({ symbol: s, bid: (prices[s] ?? 100) - 0.05, ask: (prices[s] ?? 100) + 0.05, last: prices[s] ?? 100, change: 0, changePct: 0, volume: 0, high: 0, low: 0, open: 0, close: prices[s] ?? 100 }));
}
function getMockRiskMetrics() {
  return {
    totalValue: 144180.75, totalDayPL: 691.92, totalDayPLPct: 0.48, top5Concentration: 0.82,
    equityExposure: 106040.75, optionExposure: 0, cashPct: 0.102,
    concentrations: [
      { symbol: 'NVDA', value: 26262, pct: 0.182 }, { symbol: 'SPY', value: 23092.5, pct: 0.160 },
      { symbol: 'AAPL', value: 18945, pct: 0.131 }, { symbol: 'QQQ', value: 8046, pct: 0.056 }, { symbol: 'TSLA', value: 5795, pct: 0.040 },
    ],
  };
}
