type TradingServiceFetcher = {
  fetch: (request: Request) => Promise<Response>;
};

type TradingEnv = {
  TRADING_SERVICE?: TradingServiceFetcher;
  TRADING_ORIGIN?: string;
};

/**
 * Returns the base URL for the gs-trading worker.
 * In production the service binding is used (TRADING_SERVICE); a fallback
 * HTTP origin is supported for local dev via TRADING_ORIGIN env var.
 */
export function getTradingBaseUrl(env: TradingEnv): string {
  return env.TRADING_ORIGIN ?? 'https://gs-trading.goldshore.workers.dev';
}

/**
 * Forward a request to the gs-trading worker.
 * Prefers the zero-hop service binding when available, falls back to HTTP.
 */
export async function proxyToTrading(
  env: TradingEnv,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${getTradingBaseUrl(env)}${path}`;
  const request = new Request(url, init);

  if (env.TRADING_SERVICE) {
    return env.TRADING_SERVICE.fetch(request);
  }

  return fetch(request);
}
