import type { PaperPosition, PaperOrder } from '../types';

const CASH_KEY = 'paper:cash';
const DEFAULT_CASH = 100_000;

export async function getCashBalance(kv: KVNamespace): Promise<number> {
  const val = await kv.get(CASH_KEY);
  return val !== null ? parseFloat(val) : DEFAULT_CASH;
}

export async function setCashBalance(kv: KVNamespace, amount: number): Promise<void> {
  await kv.put(CASH_KEY, amount.toString());
}

export async function getPositions(db: D1Database): Promise<PaperPosition[]> {
  const result = await db.prepare('SELECT * FROM paper_positions ORDER BY opened_at DESC').all<PaperPosition>();
  return result.results ?? [];
}

export async function getPortfolio(db: D1Database, kv: KVNamespace) {
  const [positions, cash] = await Promise.all([getPositions(db), getCashBalance(kv)]);
  return { positions, cash, mode: 'PAPER SIMULATION' as const };
}

export async function applyFill(
  db: D1Database,
  kv: KVNamespace,
  order: PaperOrder,
  fillPrice: number,
  fillQty: number,
): Promise<void> {
  const now = Date.now();
  const fillValue = fillPrice * fillQty;

  if (order.side === 'buy') {
    const cash = await getCashBalance(kv);
    await setCashBalance(kv, cash - fillValue);

    const existing = await db
      .prepare('SELECT * FROM paper_positions WHERE symbol = ? AND side = ?')
      .bind(order.symbol, 'long')
      .first<PaperPosition>();

    if (existing) {
      const totalQty = existing.quantity + fillQty;
      const newAvgCost = (existing.avg_cost * existing.quantity + fillPrice * fillQty) / totalQty;
      await db
        .prepare('UPDATE paper_positions SET quantity = ?, avg_cost = ?, updated_at = ? WHERE id = ?')
        .bind(totalQty, newAvgCost, now, existing.id)
        .run();
    } else {
      const id = crypto.randomUUID();
      await db
        .prepare('INSERT INTO paper_positions (id, symbol, quantity, avg_cost, side, opened_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, order.symbol, fillQty, fillPrice, 'long', now, now)
        .run();
    }
  } else {
    const cash = await getCashBalance(kv);
    await setCashBalance(kv, cash + fillValue);

    const existing = await db
      .prepare('SELECT * FROM paper_positions WHERE symbol = ? AND side = ?')
      .bind(order.symbol, 'long')
      .first<PaperPosition>();

    if (existing) {
      const realizedPnl = (fillPrice - existing.avg_cost) * fillQty;
      const remainingQty = existing.quantity - fillQty;

      if (remainingQty <= 0.0001) {
        const closedId = crypto.randomUUID();
        await db.batch([
          db.prepare('DELETE FROM paper_positions WHERE id = ?').bind(existing.id),
          db.prepare('INSERT INTO paper_closed_positions (id, symbol, quantity, avg_cost, close_price, side, realized_pnl, opened_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(closedId, order.symbol, existing.quantity, existing.avg_cost, fillPrice, 'long', realizedPnl, existing.opened_at, now),
        ]);
      } else {
        const closedId = crypto.randomUUID();
        await db.batch([
          db.prepare('UPDATE paper_positions SET quantity = ?, updated_at = ? WHERE id = ?').bind(remainingQty, now, existing.id),
          db.prepare('INSERT INTO paper_closed_positions (id, symbol, quantity, avg_cost, close_price, side, realized_pnl, opened_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(closedId, order.symbol, fillQty, existing.avg_cost, fillPrice, 'long', realizedPnl, existing.opened_at, now),
        ]);
      }
    }
  }

  await db
    .prepare('UPDATE paper_orders SET status = ?, fill_price = ?, fill_quantity = ?, updated_at = ? WHERE id = ?')
    .bind('filled', fillPrice, fillQty, now, order.id)
    .run();
}

export async function getRealizedPnL(db: D1Database, since?: number): Promise<number> {
  if (since) {
    const result = await db
      .prepare('SELECT SUM(realized_pnl) as total FROM paper_closed_positions WHERE closed_at >= ?')
      .bind(since)
      .first<{ total: number | null }>();
    return result?.total ?? 0;
  }
  const result = await db
    .prepare('SELECT SUM(realized_pnl) as total FROM paper_closed_positions')
    .first<{ total: number | null }>();
  return result?.total ?? 0;
}
