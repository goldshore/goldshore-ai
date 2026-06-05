import type { TradingEnv, Position, Order, Quote, AccountSummary } from '../types';

const SCHWAB_TRADER_BASE = 'https://api.schwabapi.com/trader/v1';
const SCHWAB_MARKETDATA_BASE = 'https://api.schwabapi.com/marketdata/v1';
const TOKEN_URL = 'https://api.schwabapi.com/v1/oauth/token';

export class SchwabClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private env: TradingEnv) {}

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken;
    if (!this.env.SCHWAB_CLIENT_ID || !this.env.SCHWAB_CLIENT_SECRET || !this.env.SCHWAB_REFRESH_TOKEN) {
      throw new Error('Schwab credentials not configured');
    }
    // Try KV-cached access token first
    if (this.env.TRADING_KV) {
      const cached = await this.env.TRADING_KV.get('schwab:access_token');
      const expiry = await this.env.TRADING_KV.get('schwab:token_expiry');
      if (cached && expiry && parseInt(expiry) > Date.now() + 30_000) {
        this.accessToken = cached;
        this.tokenExpiry = parseInt(expiry);
        return cached;
      }
    }
    const creds = btoa(`${this.env.SCHWAB_CLIENT_ID}:${this.env.SCHWAB_CLIENT_SECRET}`);
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: this.env.SCHWAB_REFRESH_TOKEN }),
    });
    if (!res.ok) throw new Error(`Schwab token refresh failed: ${res.status}`);
    const data = await res.json() as { access_token: string; expires_in: number; refresh_token?: string };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    // Cache in KV so all Worker instances share the token
    if (this.env.TRADING_KV) {
      await Promise.all([
        this.env.TRADING_KV.put('schwab:access_token', data.access_token, { expirationTtl: data.expires_in - 60 }),
        this.env.TRADING_KV.put('schwab:token_expiry', String(this.tokenExpiry)),
        // Update refresh token if rotation occurred
        ...(data.refresh_token ? [this.env.TRADING_KV.put('schwab:refresh_token', data.refresh_token)] : []),
      ]);
    }
    return this.accessToken;
  }

  private async request<T>(base: string, path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${base}${path}`, {
      ...options,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers as Record<string, string> ?? {}) },
    });
    if (!res.ok) { const text = await res.text(); throw new Error(`Schwab API error ${res.status}: ${text}`); }
    return res.json() as Promise<T>;
  }

  private traderRequest<T>(path: string, options?: RequestInit) { return this.request<T>(SCHWAB_TRADER_BASE, path, options); }
  private marketDataRequest<T>(path: string, options?: RequestInit) { return this.request<T>(SCHWAB_MARKETDATA_BASE, path, options); }

  async getAccount(): Promise<AccountSummary> {
    if (!this.env.SCHWAB_ACCOUNT_HASH) throw new Error('SCHWAB_ACCOUNT_HASH not configured');
    const data = await this.traderRequest<any>(`/accounts/${this.env.SCHWAB_ACCOUNT_HASH}?fields=positions`);
    const agg = data.securitiesAccount?.currentBalances ?? {};
    const initial = data.securitiesAccount?.initialBalances ?? {};
    return {
      broker: 'schwab',
      accountId: data.securitiesAccount?.accountNumber ?? this.env.SCHWAB_ACCOUNT_HASH,
      totalValue: agg.liquidationValue ?? 0,
      cashBalance: agg.cashBalance ?? 0,
      buyingPower: agg.buyingPower ?? 0,
      dayPL: (agg.liquidationValue ?? 0) - (initial.liquidationValue ?? 0),
      dayPLPct: initial.liquidationValue
        ? (((agg.liquidationValue ?? 0) - initial.liquidationValue) / initial.liquidationValue) * 100 : 0,
      totalPL: 0,
    };
  }

  async getPositions(): Promise<Position[]> {
    if (!this.env.SCHWAB_ACCOUNT_HASH) throw new Error('SCHWAB_ACCOUNT_HASH not configured');
    const data = await this.traderRequest<any>(`/accounts/${this.env.SCHWAB_ACCOUNT_HASH}?fields=positions`);
    const raw = data.securitiesAccount?.positions ?? [];
    return raw.map((p: any): Position => {
      const longQty = p.longQuantity ?? 0;
      const shortQty = p.shortQuantity ?? 0;
      const netQty = longQty - shortQty;
      const marketValue = p.marketValue ?? 0;
      // Compute current price from net quantity; guard divide-by-zero
      const currentPrice = netQty !== 0 ? marketValue / netQty : (p.averagePrice ?? 0);
      return {
        symbol: p.instrument?.symbol ?? '',
        quantity: netQty,
        avgCost: p.averagePrice ?? 0,
        currentPrice,
        marketValue,
        unrealizedPL: p.currentDayProfitLoss ?? 0,
        unrealizedPLPct: p.currentDayProfitLossPercentage ?? 0,
        broker: 'schwab',
        assetType: p.instrument?.assetType === 'OPTION' ? 'OPTION' : 'EQUITY',
      };
    });
  }

  async getOrders(): Promise<Order[]> {
    if (!this.env.SCHWAB_ACCOUNT_HASH) throw new Error('SCHWAB_ACCOUNT_HASH not configured');
    const fromDate = new Date(Date.now() - 7 * 86400 * 1000).toISOString().split('T')[0];
    const toDate = new Date().toISOString().split('T')[0];
    const data = await this.traderRequest<any[]>(
      `/accounts/${this.env.SCHWAB_ACCOUNT_HASH}/orders?fromEnteredTime=${fromDate}&toEnteredTime=${toDate}&maxResults=50`
    );
    return (data ?? []).map((o: any): Order => ({
      id: String(o.orderId),
      broker: 'schwab',
      symbol: o.orderLegCollection?.[0]?.instrument?.symbol ?? '',
      side: o.orderLegCollection?.[0]?.instruction === 'SELL' ? 'SELL' : 'BUY',
      quantity: o.quantity ?? 0,
      orderType: o.orderType ?? 'MARKET',
      limitPrice: o.price,
      stopPrice: o.stopPrice,
      status: mapSchwabStatus(o.status),
      filledQuantity: o.filledQuantity ?? 0,
      filledPrice: o.orderActivityCollection?.[0]?.executionLegs?.[0]?.price,
      placedAt: o.enteredTime ?? '',
      updatedAt: o.closeTime ?? o.enteredTime ?? '',
    }));
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    // Uses the separate marketdata base URL — NOT the trader/v1 base
    const data = await this.marketDataRequest<Record<string, any>>(`/quotes?symbols=${symbols.join(',')}&fields=quote`);
    return Object.entries(data).map(([symbol, d]: [string, any]): Quote => ({
      symbol,
      bid: d.quote?.bidPrice ?? 0,
      ask: d.quote?.askPrice ?? 0,
      last: d.quote?.lastPrice ?? 0,
      change: d.quote?.netChange ?? 0,
      changePct: d.quote?.netPercentChangeInDouble ?? 0,
      volume: d.quote?.totalVolume ?? 0,
      high: d.quote?.highPrice ?? 0,
      low: d.quote?.lowPrice ?? 0,
      open: d.quote?.openPrice ?? 0,
      close: d.quote?.closePrice ?? 0,
    }));
  }

  async placeOrder(order: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT';
    limitPrice?: number;
  }): Promise<{ orderId: string }> {
    if (!this.env.SCHWAB_ACCOUNT_HASH) throw new Error('SCHWAB_ACCOUNT_HASH not configured');
    const body: any = {
      orderType: order.orderType,
      session: 'NORMAL',
      duration: 'DAY',
      orderStrategyType: 'SINGLE',
      orderLegCollection: [{ instruction: order.side, quantity: order.quantity, instrument: { symbol: order.symbol, assetType: 'EQUITY' } }],
    };
    if (order.orderType === 'LIMIT') body.price = order.limitPrice;
    const token = await this.getAccessToken();
    const res = await fetch(`${SCHWAB_TRADER_BASE}/accounts/${this.env.SCHWAB_ACCOUNT_HASH}/orders`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Order failed: ${await res.text()}`);
    const location = res.headers.get('Location') ?? '';
    return { orderId: location.split('/').pop() ?? String(Date.now()) };
  }

  async cancelOrder(orderId: string): Promise<void> {
    if (!this.env.SCHWAB_ACCOUNT_HASH) throw new Error('SCHWAB_ACCOUNT_HASH not configured');
    const token = await this.getAccessToken();
    const res = await fetch(
      `${SCHWAB_TRADER_BASE}/accounts/${this.env.SCHWAB_ACCOUNT_HASH}/orders/${orderId}`,
      { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cancel order ${orderId} failed (${res.status}): ${text}`);
    }
  }

  async getTokenStatus(): Promise<{ hasAccessToken: boolean; hasRefreshToken: boolean; expiresAt?: string }> {
    const accessToken = await this.env.TRADING_KV?.get('schwab:access_token');
    const expiry = await this.env.TRADING_KV?.get('schwab:token_expiry');
    const refreshToken = await this.env.TRADING_KV?.get('schwab:refresh_token');
    return {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!(refreshToken ?? this.env.SCHWAB_REFRESH_TOKEN),
      expiresAt: expiry ? new Date(parseInt(expiry)).toISOString() : undefined,
    };
  }
}

function mapSchwabStatus(s: string): Order['status'] {
  const map: Record<string, Order['status']> = {
    AWAITING_PARENT_ORDER: 'PENDING', AWAITING_CONDITION: 'PENDING', AWAITING_STOP_CONDITION: 'PENDING',
    AWAITING_MANUAL_REVIEW: 'PENDING', ACCEPTED: 'OPEN', AWAITING_UR_OUT: 'OPEN',
    PENDING_ACTIVATION: 'OPEN', QUEUED: 'OPEN', WORKING: 'OPEN', REJECTED: 'REJECTED',
    PENDING_CANCEL: 'OPEN', CANCELED: 'CANCELLED', PENDING_REPLACE: 'OPEN',
    REPLACED: 'CANCELLED', FILLED: 'FILLED', EXPIRED: 'CANCELLED',
  };
  return map[s] ?? 'OPEN';
}
