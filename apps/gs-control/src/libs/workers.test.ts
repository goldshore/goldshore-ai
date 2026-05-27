import { describe, it } from 'node:test';
import assert from 'node:assert';
import { reconcile } from './workers';
import type { ControlEnv } from './types';

describe('workers lib', () => {
  it('reconcile should return success status', async () => {
    const env = {} as ControlEnv;
    const result = await reconcile(env);
    assert.deepStrictEqual(result, { status: 'workers reconciled', ok: true });
  });
});
