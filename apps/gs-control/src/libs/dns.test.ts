import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sync } from './dns.ts';
import type { ControlEnv } from './types.ts';

describe('DNS Lib', () => {
  const mockEnv = {} as ControlEnv;

  it('should return dns synced status', async () => {
    const result = await sync(mockEnv);
    assert.deepStrictEqual(result, { status: 'dns synced', ok: true });
  });
});
