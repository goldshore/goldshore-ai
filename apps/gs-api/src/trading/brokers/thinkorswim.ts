import type { TradingEnv, Position, Order, Quote, AccountSummary } from '../types';

const TOS_ACCOUNTS_BASE = 'https://api.schwabapi.com/trader/v1/accounts';
const TOS_MARKETDATA_BASE = 'https://api.schwabapi.com/marketdata/v1';
const TOKEN_URL = 'https://api.schwabapi.com/v1/oauth/token';

/**
 * Charles Schwab thinkorswim (ToS) API client
 * thinkorswim is Schwab's professional trading platform
 * Uses the same Schwab API endpoints as the standard trader application
 */
export class ThinkorswimClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private env: TradingEnv) {}

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken;

    if (!this.env.SCHWAB_CLIENT_ID || !this.env.SCHWAB_CLIENT_SECRET) {
      throw new Error('Schwab credentials not configured (missing SCHWAB_CLIENT_ID or SCHWAB_CLIENT_SECRET)');
    }

    // Try to load cached token from KV
    if (this.env.TRADING_KV) {
      const cached = await this.env.TRADING_KV.get('tos:access_token');
      const expiry = await this.env.TRADING_KV.get('tos:token_expiry');
      if (cached && expiry && parseInt(expiry) > Date.now() + 30_000) {
        this.accessToken = cached;
        this.tokenExpiry = parseInt(expiry);
        return cached;
      }
    }

    // Get or refresh the token
    const storedRefreshToken = this.env.TRADING_KV
      ? await this.env.TRADING_KV.get('tos:refresh_token')
      : null;
    const refreshToken = storedRefreshToken ?? this.env.SCHWAB_REFRESH_TOKEN;
    if (!refreshToken) {
      throw new Error('No refresh token available — complete OAuth at /oauth/schwab/authorize');
    }

    const creds = btoa(`${this.env.SCHWAB_CLIENT_ID}:${this.env.SCHWAB_CLIENT_SECRET}`);
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
    const data = await res.json() as { access_token: string; expires_in: number; refresh_token?: string };

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

    // Cache in KV
    if (this.env.TRADING_KV) {
      await Promise.all([
        this.env.TRADING_KV.put('tos:access_token', data.access_token, { expirationTtl: data.expires_in - 60 }),
        this.env.TRADING_KV.put('tos:token_expiry', this.tokenExpiry.toString()),
      ]);
      if (data.refresh_token) {
        await this.env.TRADING_KV.put('tos:refresh_token', data.refresh_token);
      }
    }

    return this.accessToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${TOS_ACCOUNTS_BASE}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        ...(options.headers as Record<string, string> ?? {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ToS API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  private async marketDataRequest<T>(path: string, options?: RequestInit): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${TOS_MARKETDATA_BASE}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        ...(options?.headers as Record<string, string> ?? {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ToS MarketData API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async getAccount(): Promise<AccountSummary> {
    const accountHash = this.env.SCHWAB_ACCOUNT_HASH;
    if (!accountHash) {
      throw new Error('SCHWAB_ACCOUNT_HASH required for ToS account access');
    }

    const data = await this.request<any>(`/${accountHash}`);
    const acct = data.securitiesAccount ?? {};

    return {
      broker: 'tos' as any, // Note: 'tos' type should be added to BrokerName union
      accountId: accountHash,
      totalValue: parseFloat(acct.accountValue ?? '0'),
      cashBalance: parseFloat(acct.moneyMarketFund?.value ?? '0'),
      buyingPower: parseFloat(acct.buyingPower?.value ?? '0'),
      dayPL: parseFloat(acct.currentBalances?.accruedInterest ?? '0'),
      dayPLPct: 0, // Calculate if needed
      totalPL: parseFloat(acct.projectedBalances?.accruedInterest ?? '0'),
    };
  }

  async getPositions(): Promise<Position[]> {
    const accountHash = this.env.SCHWAB_ACCOUNT_HASH;
    if (!accountHash) throw new Error('SCHWAB_ACCOUNT_HASH required');

    const data = await this.request<any>(`/${accountHash}/positions`);
    const positions = data.securitiesAccount?.positions ?? [];

    return positions.map((p: any) => {
      const qty = parseFloat(p.longQuantity ?? '0');
      const instrument = p.instrument ?? {};
      const currentPrice = parseFloat(p.marketValue ?? '0') / (qty || 1);
      const avgCost = parseFloat(p.averagePrice ?? '0');

      return {
        symbol: instrument.symbol ?? '',
        quantity: qty,
        avgCost,
        currentPrice,
        marketValue: parseFloat(p.marketValue ?? '0'),
        unrealizedPL: (currentPrice - avgCost) * qty,
        unrealizedPLPct: avgCost ? ((currentPrice - avgCost) / avgCost) * 100 : 0,
        broker: 'tos' as any,
        assetType: mapToAssetType(instrument.assetType),
      };
    });
  }

  async getOrders(): Promise<Order[]> {
    const accountHash = this.env.SCHWAB_ACCOUNT_HASH;
    if (!accountHash) throw new Error('SCHWAB_ACCOUNT_HASH required');

    const data = await this.request<any>(`/${accountHash}/orders`, {
      method: 'GET',
      headers: { 'Range': 'orders=0-100' },
    });

    const orders = data.orders ?? [];

    return orders.map((o: any): Order => ({
      id: o.orderId?.toString() ?? '',
      broker: 'tos' as any,
      symbol: o.orderStrategyType === 'SINGLE' ? o.orderLegCollection?.[0]?.instrument?.symbol ?? '' : '',
      side: o.orderLegCollection?.[0]?.instruction?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
      quantity: parseFloat(o.quantity ?? '0'),
      orderType: mapOrderType(o.orderType),
      limitPrice: o.price ? parseFloat(o.price) : undefined,
      stopPrice: o.stopPrice ? parseFloat(o.stopPrice) : undefined,
      status: mapOrderStatus(o.status),
      filledQuantity: parseFloat(o.filledQuantity ?? '0'),
      filledPrice: o.averageFillPrice ? parseFloat(o.averageFillPrice) : undefined,
      placedAt: o.createTime ?? '',
      updatedAt: o.updateTime ?? '',
    }));
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    if (symbols.length === 0) return [];

    // Fetch quotes from marketdata endpoint
    const quotesData: Quote[] = [];

    for (const symbol of symbols) {
      try {
        const data = await this.marketDataRequest<any>(`/quotes/${symbol}`);
        const q = data.quote ?? {};

        quotesData.push({
          symbol: q.symbol ?? symbol,
          bid: parseFloat(q.bidPrice ?? '0'),
          ask: parseFloat(q.askPrice ?? '0'),
          last: parseFloat(q.lastPrice ?? '0'),
          change: parseFloat(q.netChange ?? '0'),
          changePct: parseFloat(q.netPercentChangeInDouble ?? '0') * 100,
          volume: parseFloat(q.totalVolume ?? '0'),
          high: parseFloat(q.highPrice ?? '0'),
          low: parseFloat(q.lowPrice ?? '0'),
          open: parseFloat(q.openPrice ?? '0'),
          close: parseFloat(q.closePrice ?? '0'),
        });
      } catch (error) {
        console.warn(`Failed to fetch quote for ${symbol}:`, error);
        // Return partial quotes on error
        quotesData.push({
          symbol,
          bid: 0, ask: 0, last: 0, change: 0, changePct: 0,
          volume: 0, high: 0, low: 0, open: 0, close: 0,
        });
      }
    }

    return quotesData;
  }

  async placeOrder(order: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT';
    limitPrice?: number;
  }): Promise<{ orderId: string }> {
    const accountHash = this.env.SCHWAB_ACCOUNT_HASH;
    if (!accountHash) throw new Error('SCHWAB_ACCOUNT_HASH required');

    const body = {
      orderType: order.orderType,
      session: 'NORMAL',
      duration: 'DAY',
      orderStrategyType: 'SINGLE',
      orderLegCollection: [
        {
          instruction: order.side,
          quantity: order.quantity,
          instrument: {
            symbol: order.symbol,
            assetType: 'EQUITY',
          },
        },
      ],
    };

    if (order.orderType === 'LIMIT' && order.limitPrice) {
      (body as any).price = order.limitPrice;
    }

    const res = await fetch(`${TOS_ACCOUNTS_BASE}/${accountHash}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await this.getAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to place order: ${error}`);
    }

    // Parse order ID from Location header or response
    const location = res.headers.get('Location');
    const orderId = location?.split('/').pop() ?? Date.now().toString();

    return { orderId };
  }

  async cancelOrder(orderId: string): Promise<void> {
    const accountHash = this.env.SCHWAB_ACCOUNT_HASH;
    if (!accountHash) throw new Error('SCHWAB_ACCOUNT_HASH required');

    const res = await fetch(`${TOS_ACCOUNTS_BASE}/${accountHash}/orders/${orderId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${await this.getAccessToken()}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to cancel order ${orderId}`);
    }
  }

  async getTokenStatus(): Promise<{ configured: boolean; valid: boolean; expiresAt?: string }> {
    try {
      const token = await this.getAccessToken();
      return {
        configured: true,
        valid: !!token,
        expiresAt: new Date(this.tokenExpiry).toISOString(),
      };
    } catch {
      return {
        configured: false,
        valid: false,
      };
    }
  }
}

function mapToAssetType(
  assetType: string | undefined
): Position['assetType'] {
  const map: Record<string, Position['assetType']> = {
    EQUITY: 'EQUITY',
    OPTION: 'OPTION',
    ETF: 'ETF',
    MUTUAL_FUND: 'ETF', // Group mutual funds with ETFs
  };
  return map[assetType ?? ''] ?? 'EQUITY';
}

function mapOrderType(t: string | undefined): Order['orderType'] {
  const map: Record<string, Order['orderType']> = {
    MARKET: 'MARKET',
    LIMIT: 'LIMIT',
    STOP: 'STOP',
    STOP_LIMIT: 'STOP_LIMIT',
  };
  return map[t ?? ''] ?? 'MARKET';
}

function mapOrderStatus(status: string | undefined): Order['status'] {
  const map: Record<string, Order['status']> = {
    AWAITING_PARENT_ORDER: 'PENDING',
    AWAITING_CONDITION: 'PENDING',
    AWAITING_MANUAL_REVIEW: 'PENDING',
    ACCEPTED: 'OPEN',
    QUEUED: 'OPEN',
    WORKING: 'OPEN',
    REJECTED: 'REJECTED',
    PENDING_ACTIVATION: 'PENDING',
    EXPIRED: 'REJECTED',
    CANCELLED: 'CANCELLED',
    FILLED: 'FILLED',
    PARTIALLY_FILLED: 'OPEN',
  };
  return map[status ?? ''] ?? 'OPEN';
}
