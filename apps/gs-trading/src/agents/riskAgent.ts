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

  // For sells: only exempt the portion that closes an existing long position.
  // Any quantity sold beyond current holdings creates short exposure subject to risk limits.
  const existingPos = positions.find(p => p.symbol === order.symbol);
  const heldQty = existingPos?.quantity ?? 0;
  const orderQty = order.quantity ?? 0;
  const pricePerUnit = orderQty > 0 ? order.estimatedValue / orderQty : 0;
  const shortExcessQty = isSell ? Math.max(0, orderQty - heldQty) : 0;
  const riskableValue = isSell ? shortExcessQty * pricePerUnit : order.estimatedValue;

  const positionPct = totalValue > 0 ? riskableValue / totalValue : 0;
  if (positionPct > config.maxPositionSizePct) {
    violations.push(
      `${isSell ? 'Short exposure' : 'Order size'} ${(positionPct * 100).toFixed(1)}% exceeds max position size ${(config.maxPositionSizePct * 100).toFixed(1)}%`
    );
  }
  if (positionPct > config.maxPositionSizePct * 0.8) {
    warnings.push(`${isSell ? 'Short exposure' : 'Order size'} approaching max position limit (${(positionPct * 100).toFixed(1)}%)`);
  }

  const dailyLossPct = totalValue > 0 ? Math.abs(totalDayPL) / totalValue : 0;
  if (totalDayPL < 0 && dailyLossPct > config.maxDailyLossPct) {
    violations.push(
      `Daily loss ${(dailyLossPct * 100).toFixed(2)}% exceeds max ${(config.maxDailyLossPct * 100).toFixed(2)}%`
    );
  }

  if (!isSell) {
    const existingValue = existingPos?.marketValue ?? 0;
    const combinedValue = existingValue + order.estimatedValue;
    const combinedPct = totalValue > 0 ? combinedValue / totalValue : 0;
    if (combinedPct > config.maxConcentrationPct) {
      violations.push(
        `Combined concentration ${(combinedPct * 100).toFixed(1)}% exceeds max ${(config.maxConcentrationPct * 100).toFixed(1)}%`
      );
    }
  } else if (shortExcessQty > 0) {
    // Short exposure concentration check
    const shortConcentrationPct = totalValue > 0 ? riskableValue / totalValue : 0;
    if (shortConcentrationPct > config.maxConcentrationPct) {
      violations.push(
        `Short concentration ${(shortConcentrationPct * 100).toFixed(1)}% exceeds max ${(config.maxConcentrationPct * 100).toFixed(1)}%`
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
