import { describe, it } from 'node:test';
import assert from 'node:assert';
import { withContractHeaders, getRuntimeVersion, API_SCHEMA_VERSION } from './contract.ts';

describe('contract utilities', () => {
  describe('withContractHeaders', () => {
    it('should add schemaVersion and apiVersion to the payload', () => {
      const payload = { data: 'test' };
      const runtimeVersion = 'v2';
      const result = withContractHeaders(payload, runtimeVersion);

      assert.deepStrictEqual(result, {
        data: 'test',
        schemaVersion: API_SCHEMA_VERSION,
        apiVersion: 'v2',
      });
    });

    it('should fall back to v1 if runtimeVersion is undefined', () => {
      const payload = { foo: 'bar' };
      const result = withContractHeaders(payload, undefined);

      assert.strictEqual(result.apiVersion, 'v1');
      assert.strictEqual(result.foo, 'bar');
      assert.strictEqual(result.schemaVersion, API_SCHEMA_VERSION);
    });

    it('should preserve original payload properties', () => {
       const payload = { id: 1, name: 'test' };
       const result = withContractHeaders(payload, 'v3');
       assert.strictEqual(result.id, 1);
       assert.strictEqual(result.name, 'test');
    });
  });

  describe('getRuntimeVersion', () => {
    it('should return API_VERSION if present', () => {
      const env = { API_VERSION: 'v2', GIT_SHA: 'abc123' };
      assert.strictEqual(getRuntimeVersion(env), 'v2');
    });

    it('should return GIT_SHA if API_VERSION is missing', () => {
      const env = { GIT_SHA: 'abc123' };
      assert.strictEqual(getRuntimeVersion(env), 'abc123');
    });

    it('should return v1 if both API_VERSION and GIT_SHA are missing', () => {
      const env = {};
      assert.strictEqual(getRuntimeVersion(env), 'v1');
    });

    it('should return v1 if env is null', () => {
      assert.strictEqual(getRuntimeVersion(null), 'v1');
    });

    it('should return v1 if env is undefined', () => {
      assert.strictEqual(getRuntimeVersion(undefined), 'v1');
    });
  });
});
