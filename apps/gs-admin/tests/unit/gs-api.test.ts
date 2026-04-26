import { test } from 'node:test';
import assert from 'node:assert';
// Note: The .ts extension is required here for the native Node.js test runner
// when using --experimental-strip-types, as it does not perform automatic
// extension resolution for ESM imports.
import { getGsApiBaseUrl, buildGsApiHeaders } from '../../src/lib/gs-api.ts';

test('getGsApiBaseUrl returns API_ORIGIN from env if present', () => {
  const env = { API_ORIGIN: 'https://custom-api.goldshore.ai' };
  const result = getGsApiBaseUrl(env);
  assert.strictEqual(result, 'https://custom-api.goldshore.ai');
});

test('getGsApiBaseUrl returns default URL if API_ORIGIN is missing', () => {
  const env = {};
  const result = getGsApiBaseUrl(env);
  assert.strictEqual(result, 'https://api.goldshore.ai');
});

test('buildGsApiHeaders includes Authorization header if present in request', () => {
  const request = new Request('https://example.com', {
    headers: {
      'Authorization': 'Bearer test-token'
    }
  });
  const headers = buildGsApiHeaders(request);
  assert.strictEqual(headers['Content-Type'], 'application/json');
  assert.strictEqual(headers['Authorization'], 'Bearer test-token');
});

test('buildGsApiHeaders forwards Cloudflare Access JWT when present', () => {
  const request = new Request('https://example.com', {
    headers: {
      'CF-Access-Jwt-Assertion': 'cf-jwt-token'
    }
  });
  const headers = buildGsApiHeaders(request);
  assert.strictEqual(headers['Content-Type'], 'application/json');
  assert.strictEqual(headers['CF-Access-Jwt-Assertion'], 'cf-jwt-token');
});

test('buildGsApiHeaders omits auth headers if missing in request', () => {
  const request = new Request('https://example.com');
  const headers = buildGsApiHeaders(request);
  assert.strictEqual(headers['Content-Type'], 'application/json');
  assert.strictEqual('Authorization' in headers, false);
  assert.strictEqual('CF-Access-Jwt-Assertion' in headers, false);
});
