import type { TradingEnv, Position, Order, Quote, AccountSummary } from '../types';

const RH_BASE = 'https://api.robinhood.com';

export class RobinhoodClient {
  constructor(private env: TradingEnv) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!this.env.ROBINHOOD_TOKEN) throw new Error('ROBINHOOD_TOKEN not configured');
    const res = await fetch(`${RH_BASE}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.env.ROBINHOOD_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers as Record<string, string> ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Robinhood API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async getAccount(): Promise<AccountSummary> {
    const data = await this.request<any>('/accounts/?default_to_all_robinhood_accounts=false');
    const acct = data.results?.[0] ?? {};
    const portfolio = await this.request<any>(`/portfolios/${acct.account_number}/`);
    return {
      broker: 'robinhood',
      accountId: acct.account_number ?? this.env.ROBINHOOD_ACCOUNT_ID ?? '',
      totalValue: parseFloat(portfolio.equity ?? '0'),
      cashBalance: parseFloat(acct.cash ?? '0'),
      buyingPower: parseFloat(acct.buying_power ?? '0'),
      dayPL: parseFloat(portfolio.equity_previous_close ?? '0')
        ? parseFloat(portfolio.equity ?? '0') - parseFloat(portfolio.equity_previous_close ?? '0')
        : 0,
      dayPLPct: parseFloat(portfolio.equity_previous_close ?? '0')
        ? ((parseFloat(portfolio.equity ?? '0') - parseFloat(portfolio.equity_previous_close ?? '0')) /
          parseFloat(portfolio.equity_previous_close ?? '1')) * 100
        : 0,
      totalPL: parseFloat(portfolio.total_return ?? '0'),
    };
  }

  async getPositions(): Promise<Position[]> {
    const data = await this.request<any>('/positions/?nonzero=true');
    const results = data.results ?? [];
    const positions: Position[] = [];
    for (const p of results) {
      const instrument = await fetch(p.instrument, {
        headers: { 'Authorization': `Bearer ${this.env.ROBINHOOD_TOKEN}` },
      }).then(r => r.json()) as any;
      const quote = await fetch(instrument.quote, {
        headers: { 'Authorization': `Bearer ${this.env.ROBINHOOD_TOKEN}` },
      }).then(r => r.json()) as any;
      const qty = parseFloat(p.quantity ?? '0');
      const avgCost = parseFloat(p.average_buy_price ?? '0');
      const currentPrice = parseFloat(quote.last_trade_price ?? '0');
      positions.push({
        symbol: instrument.symbol ?? '',
        quantity: qty,
        avgCost,
        currentPrice,
        marketValue: qty * currentPrice,
        unrealizedPL: qty * (currentPrice - avgCost),
        unrealizedPLPct: avgCost ? ((currentPrice - avgCost) / avgCost) * 100 : 0,
        broker: 'robinhood',
        assetType: 'EQUITY',
      });
    }
    return positions;
  }

  async getOrders(): Promise<Order[]> {
    const data = await this.request<any>('/orders/');
    return (data.results ?? []).map((o: any): Order => ({
      id: o.id ?? '',
      broker: 'robinhood',
      symbol: '', // requires instrument fetch; resolved client-side
      side: o.side?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
      quantity: parseFloat(o.quantity ?? '0'),
      orderType: mapRHOrderType(o.type),
      limitPrice: o.price ? parseFloat(o.price) : undefined,
      stopPrice: o.stop_price ? parseFloat(o.stop_price) : undefined,
      status: mapRHStatus(o.state),
      filledQuantity: parseFloat(o.cumulative_quantity ?? '0'),
      filledPrice: o.average_price ? parseFloat(o.average_price) : undefined,
      placedAt: o.created_at ?? '',
      updatedAt: o.updated_at ?? '',
    }));
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const data = await this.request<any>(
      `/quotes/?symbols=${symbols.join(',')}`
    );
    return (data.results ?? []).map((q: any): Quote => ({
      symbol: q.symbol ?? '',
      bid: parseFloat(q.bid_price ?? '0'),
      ask: parseFloat(q.ask_price ?? '0'),
      last: parseFloat(q.last_trade_price ?? '0'),
      change: parseFloat(q.last_trade_price ?? '0') - parseFloat(q.previous_close ?? '0'),
      changePct: parseFloat(q.previous_close ?? '0')
        ? ((parseFloat(q.last_trade_price ?? '0') - parseFloat(q.previous_close ?? '0')) /
          parseFloat(q.previous_close ?? '1')) * 100
        : 0,
      volume: parseFloat(q.volume ?? '0'),
      high: parseFloat(q.high_price ?? '0'),
      low: parseFloat(q.low_price ?? '0'),
      open: parseFloat(q.open ?? '0'),
      close: parseFloat(q.previous_close ?? '0'),
    }));
  }

  async placeOrder(order: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT';
    limitPrice?: number;
    accountUrl: string;
    instrumentUrl: string;
  }): Promise<{ orderId: string }> {
    const body: any = {
      account: order.accountUrl,
      instrument: order.instrumentUrl,
      symbol: order.symbol,
      side: order.side.toLowerCase(),
      type: order.orderType.toLowerCase(),
      quantity: order.quantity,
      time_in_force: 'gfd',
      trigger: 'immediate',
    };
    if (order.orderType === 'LIMIT') body.price = order.limitPrice;
    const data = await this.request<any>('/orders/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { orderId: data.id ?? '' };
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.request(`/orders/${orderId}/cancel/`, { method: 'POST' });
  }
}

function mapRHOrderType(t: string): Order['orderType'] {
  const m: Record<string, Order['orderType']> = {
    market: 'MARKET', limit: 'LIMIT', stop: 'STOP', stop_limit: 'STOP_LIMIT',
  };
  return m[t] ?? 'MARKET';
}

function mapRHStatus(s: string): Order['status'] {
  const m: Record<string, Order['status']> = {
    queued: 'PENDING', unconfirmed: 'PENDING', confirmed: 'OPEN',
    partially_filled: 'OPEN', filled: 'FILLED', rejected: 'REJECTED',
    cancelled: 'CANCELLED', failed: 'REJECTED',
  };
  return m[s] ?? 'OPEN';
}
