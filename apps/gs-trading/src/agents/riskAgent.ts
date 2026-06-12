import type { Position, Order, AccountSummary } from '../types';

export interface RiskConfig {
  maxPositionSizePct: number;
  maxDrawdownPct: number;
  maxDailyLossPct: number;
  maxConcentrationPct: number;
  allowedAssetTypes: string[];
}

export interface RiskCheck {
  passed: boolean;
  violations: string[];
  warnings: string[];
}

export function checkOrderRisk(
  order: Partial<Order> & { estimatedValue: number },
  accounts: AccountSummary[],
  positions: Position[],
  config: RiskConfig,
): RiskCheck {
  const violations: string[] = [];
  const warnings: string[] = [];
  const totalValue = accounts.reduce((s, a) => s + a.totalValue, 0);
  const totalDayPL = accounts.reduce((s, a) => s + a.dayPL, 0);
  const isSell = order.side === 'SELL';

  // Separate existing long and short quantities to handle both directions correctly.
  // existingLong > 0: currently long; existingShort < 0: currently short.
  const existingPos = positions.find(p => p.symbol === order.symbol);
  const existingQty = existingPos?.quantity ?? 0;
  const existingLong = Math.max(0, existingQty);
  const existingShort = Math.min(0, existingQty);
  const orderQty = order.quantity ?? 0;

  // Riskable quantity:
  // SELL: closing existing longs is free; only the short-opening portion is risk-checked.
  // BUY:  covering existing shorts is free; only the portion beyond zero is risk-checked.
  const riskableQty = isSell
    ? Math.max(0, orderQty - existingLong)
    : Math.max(0, orderQty + existingShort);

  const riskableFraction = orderQty > 0 ? riskableQty / orderQty : 0;
  const riskableValue = order.estimatedValue * riskableFraction;

  const positionPct = totalValue > 0 ? riskableValue / totalValue : 0;
  if (positionPct > config.maxPositionSizePct) {
    violations.push(
      `Order size ${(positionPct * 100).toFixed(1)}% exceeds max position size ${(config.maxPositionSizePct * 100).toFixed(1)}%`
    );
  }
  if (positionPct > config.maxPositionSizePct * 0.8) {
    warnings.push(`Order size approaching max position limit (${(positionPct * 100).toFixed(1)}%)`);
  }

  const dailyLossPct = totalValue > 0 ? Math.abs(totalDayPL) / totalValue : 0;
  if (totalDayPL < 0 && dailyLossPct > config.maxDailyLossPct) {
    violations.push(
      `Daily loss ${(dailyLossPct * 100).toFixed(2)}% exceeds max ${(config.maxDailyLossPct * 100).toFixed(2)}%`
    );
  }

  if (riskableQty > 0) {
    const existingAbsValue = Math.abs(existingPos?.marketValue ?? 0);
    const combinedValue = existingAbsValue + riskableValue;
    const combinedPct = totalValue > 0 ? combinedValue / totalValue : 0;
    if (combinedPct > config.maxConcentrationPct) {
      violations.push(
        `Combined concentration ${(combinedPct * 100).toFixed(1)}% exceeds max ${(config.maxConcentrationPct * 100).toFixed(1)}%`
      );
    }
  }

  return { passed: violations.length === 0, violations, warnings };
}

export function getPortfolioRiskMetrics(positions: Position[], accounts: AccountSummary[]) {
  const totalValue = accounts.reduce((s, a) => s + a.totalValue, 0);
  const totalDayPL = accounts.reduce((s, a) => s + a.dayPL, 0);
  const bySymbol: Record<string, number> = {};
  for (const p of positions) {
    bySymbol[p.symbol] = (bySymbol[p.symbol] ?? 0) + p.marketValue;
  }
  const concentrations = Object.entries(bySymbol).map(([sym, val]) => ({
    symbol: sym, value: val, pct: totalValue > 0 ? val / totalValue : 0,
  })).sort((a, b) => b.pct - a.pct);

  const top5Concentration = concentrations.slice(0, 5).reduce((s, c) => s + c.pct, 0);
  const equityExposure = positions.filter(p => p.assetType === 'EQUITY').reduce((s, p) => s + p.marketValue, 0);
  const optionExposure = positions.filter(p => p.assetType === 'OPTION').reduce((s, p) => s + p.marketValue, 0);

  return {
    totalValue,
    totalDayPL,
    totalDayPLPct: totalValue > 0 ? (totalDayPL / totalValue) * 100 : 0,
    top5Concentration,
    equityExposure,
    optionExposure,
    cashPct: totalValue > 0
      ? accounts.reduce((s, a) => s + a.cashBalance, 0) / totalValue
      : 0,
    concentrations: concentrations.slice(0, 10),
  };
}
