import type { TradingEnv } from './types';

const FLAG_PREFIX = 'flag:';

/**
 * Read a feature flag from TRADING_KV.
 * Returns true if the flag value is exactly "true".
 * Falls back to `defaultValue` if the key is absent or KV is unavailable.
 */
export async function isEnabled(
  env: TradingEnv,
  flagKey: string,
  defaultValue = false,
): Promise<boolean> {
  if (!env.TRADING_KV) return defaultValue;
  try {
    const val = await env.TRADING_KV.get(`${FLAG_PREFIX}${flagKey}`);
    if (val === null) return defaultValue;
    return val === 'true';
  } catch {
    return defaultValue;
  }
}

/**
 * Write a feature flag value to TRADING_KV.
 */
export async function setFlag(
  env: TradingEnv,
  flagKey: string,
  enabled: boolean,
): Promise<void> {
  await env.TRADING_KV.put(`${FLAG_PREFIX}${flagKey}`, enabled ? 'true' : 'false');
}

export const FLAGS = {
  MCP_TRADING: 'mcp-trading',
} as const;
