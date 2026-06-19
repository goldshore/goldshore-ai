import assert from 'node:assert/strict';
import test from 'node:test';
import { checkOrderRisk, type RiskConfig } from './riskAgent';
import type { AccountSummary, Position } from '../types';

const config: RiskConfig = {
  maxPositionSizePct: 0.05,
  maxDrawdownPct: 0.1,
  maxDailyLossPct: 0.02,
  maxConcentrationPct: 0.15,
  allowedAssetTypes: ['EQUITY', 'ETF'],
};

const accounts: AccountSummary[] = [{
  broker: 'robinhood',
  accountId: 'rh',
  totalValue: 100_000,
  cashBalance: 50_000,
  buyingPower: 50_000,
  dayPL: 0,
  dayPLPct: 0,
  totalPL: 0,
}];

const position = (overrides: Partial<Position>): Position => ({
  broker: 'schwab',
  symbol: 'AAPL',
  quantity: 10,
  avgCost: 100,
  currentPrice: 100,
  marketValue: 1_000,
  unrealizedPL: 0,
  unrealizedPLPct: 0,
  assetType: 'EQUITY',
  ...overrides,
});

test('does not offset an order with a same-symbol position at another broker', () => {
  const result = checkOrderRisk(
    {
      broker: 'robinhood',
      symbol: 'AAPL',
      side: 'SELL',
      quantity: 10,
      estimatedValue: 10_000,
      assetType: 'EQUITY',
    },
    accounts,
    [position({ broker: 'schwab' })],
    config,
  );

  assert.equal(result.passed, false);
  assert.ok(result.violations.some((violation) => violation.startsWith('Order size')));
});

test('aggregates all matching broker positions when an order closes a long', () => {
  const result = checkOrderRisk(
    {
      broker: 'robinhood',
      symbol: 'AAPL',
      side: 'SELL',
      quantity: 10,
      estimatedValue: 10_000,
      assetType: 'EQUITY',
    },
    accounts,
    [
      position({ broker: 'robinhood', quantity: 4, marketValue: 400 }),
      position({ broker: 'robinhood', quantity: 6, marketValue: 600 }),
    ],
    config,
  );

  assert.equal(result.passed, true);
});

test('rejects disallowed asset types and excessive drawdown', () => {
  const result = checkOrderRisk(
    {
      broker: 'robinhood',
      symbol: 'AAPL-OPTION',
      side: 'BUY',
      quantity: 1,
      estimatedValue: 100,
      assetType: 'OPTION',
    },
    [{ ...accounts[0], totalPL: -11_000 }],
    [],
    config,
  );

  assert.equal(result.passed, false);
  assert.ok(result.violations.includes('Asset type OPTION is not allowed'));
  assert.ok(result.violations.some((violation) => violation.startsWith('Drawdown')));
});
