import type { TradingEnv } from './types';

export const FLAGS = {
  MCP_TRADING: 'flag:mcp-trading',
} as const;

/**
 * Returns whether a feature flag is enabled.
 * Reads from TRADING_KV; falls back to `defaultValue` if the key is absent.
 */
export async function isEnabled(
  env: TradingEnv,
  flag: string,
  defaultValue = false,
): Promise<boolean> {
  const val = await env.TRADING_KV.get(flag);
  if (val === null) return defaultValue;
  return val === 'true';
}

export async function setFlag(env: TradingEnv, flag: string, enabled: boolean): Promise<void> {
  await env.TRADING_KV.put(flag, String(enabled));
}
