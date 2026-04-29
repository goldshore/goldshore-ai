import { test, describe } from 'node:test';
import assert from 'node:assert';
import { RobinhoodAdapter } from './index.js';

describe('RobinhoodAdapter', () => {
  const adapter = new RobinhoodAdapter();

  test('should have correct id and name', () => {
    assert.strictEqual(adapter.id, 'robinhood');
    assert.strictEqual(adapter.name, 'robinhood');
  });

  test('should implement getAccounts', async () => {
    const accounts = await adapter.getAccounts();
    assert.ok(Array.isArray(accounts));
  });

  test('should implement getPositions', async () => {
    const positions = await adapter.getPositions('test-account');
    assert.ok(Array.isArray(positions));
  });
});
