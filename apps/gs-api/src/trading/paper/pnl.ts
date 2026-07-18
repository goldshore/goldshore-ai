import type { PaperPosition } from '../types';

export interface DailyPnLEntry {
  date: string;
  realized: number;
  unrealized: number;
  total: number;
}

export function calcUnrealizedPnL(positions: PaperPosition[], prices: Record<string, number>): number {
  return positions.reduce((sum, pos) => {
    const price = prices[pos.symbol] ?? pos.avg_cost;
    const pnl = (price - pos.avg_cost) * pos.quantity;
    return sum + (pos.side === 'long' ? pnl : -pnl);
  }, 0);
}

export async function getRealizedPnLToday(db: D1Database): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const result = await db
    .prepare('SELECT SUM(realized_pnl) as total FROM paper_closed_positions WHERE closed_at >= ?')
    .bind(startOfDay.getTime())
    .first<{ total: number | null }>();
  return result?.total ?? 0;
}

export async function getPnLHistory(db: D1Database, days = 30): Promise<DailyPnLEntry[]> {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const result = await db
    .prepare(`
      SELECT
        date(closed_at / 1000, 'unixepoch') as date,
        SUM(realized_pnl) as realized
      FROM paper_closed_positions
      WHERE closed_at >= ?
      GROUP BY date
      ORDER BY date ASC
    `)
    .bind(since)
    .all<{ date: string; realized: number }>();

  return (result.results ?? []).map((row) => ({
    date: row.date,
    realized: row.realized,
    unrealized: 0,
    total: row.realized,
  }));
}
