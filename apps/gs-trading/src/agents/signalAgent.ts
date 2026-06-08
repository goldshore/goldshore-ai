import type { TradingSignal } from '../types';

interface OHLCV { open: number; high: number; low: number; close: number; volume: number; }

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function macd(closes: number[]): { line: number; signal: number; histogram: number } {
  if (closes.length < 26) return { line: 0, signal: 0, histogram: 0 };
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine.slice(-9), 9);
  const last = macdLine.length - 1;
  const line = macdLine[last];
  const signal = signalLine[signalLine.length - 1];
  return { line, signal, histogram: line - signal };
}

export function analyzeSymbol(symbol: string, candles: OHLCV[]): TradingSignal {
  const closes = candles.map(c => c.close);
  const rsiVal = rsi(closes);
  const { line: macdLine, histogram } = macd(closes);

  let action: TradingSignal['action'] = 'HOLD';
  let confidence = 0.5;
  const reasons: string[] = [];

  if (rsiVal < 30) { action = 'BUY'; confidence += 0.15; reasons.push(`RSI oversold (${rsiVal.toFixed(1)})`); }
  else if (rsiVal > 70) { action = 'SELL'; confidence += 0.15; reasons.push(`RSI overbought (${rsiVal.toFixed(1)})`); }

  if (histogram > 0 && macdLine > 0) {
    if (action !== 'SELL') { action = 'BUY'; confidence += 0.1; }
    reasons.push('MACD bullish crossover');
  } else if (histogram < 0 && macdLine < 0) {
    if (action !== 'BUY') { action = 'SELL'; confidence += 0.1; }
    reasons.push('MACD bearish crossover');
  }

  const last = closes[closes.length - 1];
  const targetPrice = action === 'BUY' ? last * 1.03 : action === 'SELL' ? last * 0.97 : last;
  const stopLoss = action === 'BUY' ? last * 0.98 : action === 'SELL' ? last * 1.02 : last;

  return {
    id: `sig-${symbol}-${Date.now()}`,
    symbol,
    action,
    confidence: Math.min(confidence, 0.99),
    targetPrice,
    stopLoss,
    reasoning: reasons.length ? reasons.join('; ') : 'No strong signal detected — holding.',
    generatedBy: 'signal-agent',
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  };
}
