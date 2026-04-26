import { test } from 'node:test';
import assert from 'node:assert';

/**
 * Note: Explicit .ts extension is required for the experimental-strip-types
 * Node.js test runner as configured in this project's package.json.
 */
import { getServerEnv } from '../../src/lib/server-env.ts';

test('getServerEnv returns locals.runtime.env when it exists', () => {
  const mockEnv = { API_KEY: 'test-key' };
  const locals = {
    runtime: {
      env: mockEnv
    }
  };

  const result = getServerEnv(locals as Record<string, unknown>);
  assert.strictEqual(result, mockEnv);
});

test('getServerEnv returns process.env when locals.runtime is missing', () => {
  const locals = {};

  const result = getServerEnv(locals as Record<string, unknown>);
  assert.strictEqual(result, process.env);
});

test('getServerEnv returns process.env when locals.runtime.env is missing', () => {
  const locals = {
    runtime: {}
  };

  const result = getServerEnv(locals as Record<string, unknown>);
  assert.strictEqual(result, process.env);
});
