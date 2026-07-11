import { Hono } from 'hono';
import type { TradingEnv, PaperOrder } from '../types';
import { getPortfolio, getCashBalance, applyFill, getRealizedPnL } from '../paper/ledger';
import { simulateFill } from '../paper/fillSimulator';
import { calcUnrealizedPnL, getRealizedPnLToday, getPnLHistory } from '../paper/pnl';
import { notify } from '../notifications';

const paper = new Hono<{ Bindings: TradingEnv }>();

function requireDB(c: any) {
  if (!c.env.PAPER_DB) {
    return c.json({ error: 'PAPER_DB not configured' }, 503);
  }
  return null;
}

// GET /paper/portfolio
paper.get('/portfolio', async (c) => {
  const err = requireDB(c);
  if (err) return err;
  const db = c.env.PAPER_DB!;
  const portfolio = await getPortfolio(db, c.env.TRADING_KV);
  const positions = portfolio.positions;

  const prices: Record<string, number> = {};
  for (const pos of positions) {
    prices[pos.symbol] = pos.avg_cost;
  }
  const unrealizedPnL = calcUnrealizedPnL(positions, prices);

  return c.json({
    mode: 'PAPER SIMULATION',
    cash: portfolio.cash,
    positions,
    unrealizedPnL,
    totalEquity: portfolio.cash + positions.reduce((s, p) => s + p.avg_cost * p.quantity, 0),
  });
});

// GET /paper/orders
paper.get('/orders', async (c) => {
  const err = requireDB(c);
  if (err) return err;
  const status = c.req.query('status');
  let result;
  if (status) {
    result = await c.env.PAPER_DB!.prepare('SELECT * FROM paper_orders WHERE status = ? ORDER BY created_at DESC LIMIT 100').bind(status).all<PaperOrder>();
  } else {
    result = await c.env.PAPER_DB!.prepare('SELECT * FROM paper_orders ORDER BY created_at DESC LIMIT 100').all<PaperOrder>();
  }
  return c.json({ mode: 'PAPER SIMULATION', orders: result.results ?? [] });
});

// POST /paper/orders
paper.post('/orders', async (c) => {
  const err = requireDB(c);
  if (err) return err;
  const db = c.env.PAPER_DB!;

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const { symbol, side, quantity, order_type, limit_price } = body;
  if (!symbol || !side || !quantity || !order_type) {
    return c.json({ error: 'symbol, side, quantity, order_type are required' }, 400);
  }
  if (!['buy', 'sell'].includes(side)) return c.json({ error: 'side must be buy or sell' }, 400);
  if (!['market', 'limit', 'stop'].includes(order_type)) return c.json({ error: 'order_type must be market, limit, or stop' }, 400);

  const now = Date.now();
  const id = crypto.randomUUID();
  const order: PaperOrder = {
    id,
    symbol: symbol.toUpperCase(),
    side,
    quantity: Number(quantity),
    order_type,
    limit_price: limit_price ?? null,
    status: 'pending',
    fill_price: null,
    fill_quantity: 0,
    source: 'manual',
    agent_recommendation_id: null,
    approved_by: null,
    created_at: now,
    updated_at: now,
  };

  const mockQuote = {
    symbol: order.symbol,
    bid: 100,
    ask: 100.1,
    last: 100.05,
    change: 0,
    changePct: 0,
    volume: 0,
    high: 100.5,
    low: 99.5,
    open: 100,
    close: 99.9,
  };

  const fill = simulateFill(order, mockQuote);

  if (fill.rejected) {
    order.status = 'rejected';
    await db.prepare('INSERT INTO paper_orders (id, symbol, side, quantity, order_type, limit_price, status, fill_price, fill_quantity, source, agent_recommendation_id, approved_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(order.id, order.symbol, order.side, order.quantity, order.order_type, order.limit_price, order.status, null, 0, order.source, null, null, now, now)
      .run();
    await notify(c.env, db, 'order_rejected', { orderId: id, reason: fill.rejectReason });
    return c.json({ mode: 'PAPER SIMULATION', order, rejected: true, reason: fill.rejectReason }, 400);
  }

  if (order.side === 'buy') {
    const cash = await getCashBalance(c.env.TRADING_KV);
    const cost = fill.fillPrice * fill.fillQty;
    if (cost > cash) {
      order.status = 'rejected';
      await db.prepare('INSERT INTO paper_orders (id, symbol, side, quantity, order_type, limit_price, status, fill_price, fill_quantity, source, agent_recommendation_id, approved_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(order.id, order.symbol, order.side, order.quantity, order.order_type, order.limit_price, 'rejected', null, 0, 'manual', null, null, now, now)
        .run();
      return c.json({ mode: 'PAPER SIMULATION', error: 'Insufficient cash', cash, required: cost }, 400);
    }
  }

  await db.prepare('INSERT INTO paper_orders (id, symbol, side, quantity, order_type, limit_price, status, fill_price, fill_quantity, source, agent_recommendation_id, approved_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(order.id, order.symbol, order.side, order.quantity, order.order_type, order.limit_price, 'open', null, 0, 'manual', null, null, now, now)
    .run();

  if (fill.fillPrice > 0) {
    await applyFill(db, c.env.TRADING_KV, { ...order, status: 'open' }, fill.fillPrice, fill.fillQty);
    await notify(c.env, db, 'order_filled', { orderId: id, symbol: order.symbol, fillPrice: fill.fillPrice, fillQty: fill.fillQty });
    order.status = 'filled';
    order.fill_price = fill.fillPrice;
    order.fill_quantity = fill.fillQty;
  } else {
    order.status = 'open';
  }

  return c.json({ mode: 'PAPER SIMULATION', order }, 201);
});

// DELETE /paper/orders/:id
paper.delete('/orders/:id', async (c) => {
  const err = requireDB(c);
  if (err) return err;
  const id = c.req.param('id');
  const db = c.env.PAPER_DB!;
  const order = await db.prepare('SELECT * FROM paper_orders WHERE id = ?').bind(id).first<PaperOrder>();
  if (!order) return c.json({ error: 'Order not found' }, 404);
  if (!['pending', 'open'].includes(order.status)) {
    return c.json({ error: `Cannot cancel order with status: ${order.status}` }, 400);
  }
  await db.prepare('UPDATE paper_orders SET status = ?, updated_at = ? WHERE id = ?').bind('cancelled', Date.now(), id).run();
  return c.json({ mode: 'PAPER SIMULATION', id, status: 'cancelled' });
});

// GET /paper/history
paper.get('/history', async (c) => {
  const err = requireDB(c);
  if (err) return err;
  const result = await c.env.PAPER_DB!.prepare('SELECT * FROM paper_closed_positions ORDER BY closed_at DESC LIMIT 100').all();
  const realizedPnL = await getRealizedPnL(c.env.PAPER_DB!);
  return c.json({ mode: 'PAPER SIMULATION', closedPositions: result.results ?? [], realizedPnL });
});

// GET /paper/pnl
paper.get('/pnl', async (c) => {
  const err = requireDB(c);
  if (err) return err;
  const db = c.env.PAPER_DB!;
  const [todayRealized, totalRealized] = await Promise.all([
    getRealizedPnLToday(db),
    getRealizedPnL(db),
  ]);
  return c.json({
    mode: 'PAPER SIMULATION',
    today: { realized: todayRealized },
    total: { realized: totalRealized },
  });
});

// GET /paper/performance
paper.get('/performance', async (c) => {
  const err = requireDB(c);
  if (err) return err;
  const days = parseInt(c.req.query('days') ?? '30', 10);
  const history = await getPnLHistory(c.env.PAPER_DB!, days);
  return c.json({ mode: 'PAPER SIMULATION', history });
});

export { paper as paperRoutes };
