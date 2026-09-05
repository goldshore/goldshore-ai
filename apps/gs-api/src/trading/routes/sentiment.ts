import { Hono } from 'hono';
import type { TradingEnv } from '../types';

// StockTwits' public endpoints require no auth/API key for trending symbols
// and per-symbol message streams. There is no official published rate limit
// for the public (unauthenticated) API, so every response is cached in
// TRADING_KV and callers always get the cached copy when it's fresh — this
// keeps us well under whatever informal limit StockTwits enforces per IP,
// and Cloudflare Workers all share a small set of egress IPs regionally.
const STOCKTWITS_BASE = 'https://api.stocktwits.com/api/2';
const TRENDING_TTL_SECONDS = 300; // 5 min
const SYMBOL_TTL_SECONDS = 120; // 2 min
const USER_AGENT = 'GoldshoreOps/1.0 (+https://goldshore.ai)';

export const sentimentRoutes = new Hono<{ Bindings: TradingEnv }>();

interface TrendingSymbol {
  symbol: string;
  title: string;
  watchlist_count: number | null;
}

interface SymbolSentiment {
  symbol: string;
  message_count: number;
  bullish: number;
  bearish: number;
  unlabeled: number;
  bullish_pct: number | null;
  sample: Array<{ body: string; sentiment: 'Bullish' | 'Bearish' | null; created_at: string }>;
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': USER_AGENT } });
  if (!response.ok) {
    throw new Error(`StockTwits request failed (${response.status}): ${url}`);
  }
  return response.json();
}

async function cached<T>(kv: KVNamespace, key: string, ttlSeconds: number, load: () => Promise<T>): Promise<{ data: T; cached: boolean }> {
  const existing = await kv.get<T>(key, 'json');
  if (existing) return { data: existing, cached: true };
  const data = await load();
  await kv.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds });
  return { data, cached: false };
}

sentimentRoutes.get('/trending', async (c) => {
  try {
    const { data, cached: wasCached } = await cached<TrendingSymbol[]>(
      c.env.TRADING_KV,
      'sentiment:stocktwits:trending',
      TRENDING_TTL_SECONDS,
      async () => {
        const body = await fetchJson(`${STOCKTWITS_BASE}/trending/symbols.json`);
        const symbols: TrendingSymbol[] = (body.symbols ?? []).map((s: any) => ({
          symbol: s.symbol,
          title: s.title ?? s.symbol,
          watchlist_count: typeof s.watchlist_count === 'number' ? s.watchlist_count : null,
        }));
        return symbols;
      }
    );
    return c.json({ provider: 'stocktwits', trending: data, cached: wasCached });
  } catch (error: any) {
    return c.json({ provider: 'stocktwits', error: error.message ?? 'Failed to fetch trending symbols' }, 502);
  }
});

sentimentRoutes.get('/symbol/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  if (!/^[A-Z.]{1,10}$/.test(symbol)) {
    return c.json({ error: 'Invalid symbol' }, 400);
  }

  try {
    const { data, cached: wasCached } = await cached<SymbolSentiment>(
      c.env.TRADING_KV,
      `sentiment:stocktwits:symbol:${symbol}`,
      SYMBOL_TTL_SECONDS,
      async () => {
        const body = await fetchJson(`${STOCKTWITS_BASE}/streams/symbol/${encodeURIComponent(symbol)}.json`);
        const messages: any[] = body.messages ?? [];

        let bullish = 0;
        let bearish = 0;
        let unlabeled = 0;
        for (const message of messages) {
          const basic = message.entities?.sentiment?.basic as 'Bullish' | 'Bearish' | undefined;
          if (basic === 'Bullish') bullish += 1;
          else if (basic === 'Bearish') bearish += 1;
          else unlabeled += 1;
        }
        const labeled = bullish + bearish;

        const result: SymbolSentiment = {
          symbol,
          message_count: messages.length,
          bullish,
          bearish,
          unlabeled,
          bullish_pct: labeled > 0 ? Math.round((bullish / labeled) * 100) : null,
          sample: messages.slice(0, 5).map((message) => ({
            body: message.body,
            sentiment: (message.entities?.sentiment?.basic as 'Bullish' | 'Bearish' | undefined) ?? null,
            created_at: message.created_at,
          })),
        };
        return result;
      }
    );
    return c.json({ provider: 'stocktwits', ...data, cached: wasCached });
  } catch (error: any) {
    return c.json({ provider: 'stocktwits', symbol, error: error.message ?? 'Failed to fetch symbol stream' }, 502);
  }
});
