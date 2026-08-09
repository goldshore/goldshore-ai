export interface TradingEnv {
  ENV?: string;
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  CLOUDFLARE_TEAM_DOMAIN?: string;
  TRADING_KV: KVNamespace;
  SCHWAB_CLIENT_ID?: string;
  SCHWAB_CLIENT_SECRET?: string;
  SCHWAB_REFRESH_TOKEN?: string;
  SCHWAB_ACCOUNT_HASH?: string;
  SCHWAB_REDIRECT_URI?: string;
  ROBINHOOD_TOKEN?: string;
  ROBINHOOD_ACCOUNT_ID?: string;
  PAPER_DB?: D1Database;
  NOTIFY_EMAIL_WEBHOOK?: string;
  NOTIFY_WEBHOOK_URL?: string;
  NOTIFY_SMS_WEBHOOK?: string;
}

export type BrokerName = 'schwab' | 'robinhood';

export interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPct: number;
  broker: BrokerName;
  assetType: 'EQUITY' | 'OPTION' | 'ETF';
}

export interface Order {
  id: string;
  broker: BrokerName;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  limitPrice?: number;
  stopPrice?: number;
  status: 'PENDING' | 'OPEN' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  filledQuantity: number;
  filledPrice?: number;
  placedAt: string;
  updatedAt: string;
}

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
}

export interface AccountSummary {
  broker: BrokerName;
  accountId: string;
  totalValue: number;
  cashBalance: number;
  buyingPower: number;
  dayPL: number;
  dayPLPct: number;
  totalPL: number;
}

export interface PaperOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  order_type: 'market' | 'limit' | 'stop';
  limit_price?: number | null;
  status: 'pending' | 'open' | 'filled' | 'cancelled' | 'rejected';
  fill_price?: number | null;
  fill_quantity: number;
  source: 'manual' | 'agent';
  agent_recommendation_id?: string | null;
  approved_by?: string | null;
  created_at: number;
  updated_at: number;
}

export interface PaperPosition {
  id: string;
  symbol: string;
  quantity: number;
  avg_cost: number;
  side: 'long' | 'short';
  opened_at: number;
  updated_at: number;
}

export interface AgentRecommendation {
  id: string;
  agent: string;
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  quantity?: number | null;
  rationale?: string | null;
  confidence?: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_at: number;
  expires_at: number;
}

export interface TradingSignal {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  targetPrice?: number;
  stopLoss?: number;
  reasoning: string;
  generatedBy: string;
  generatedAt: string;
  expiresAt: string;
  broker?: BrokerName;
}
