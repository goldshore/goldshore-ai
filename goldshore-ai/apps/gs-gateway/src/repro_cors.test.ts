import { test } from 'node:test';
import assert from 'node:assert';
import app from './index';

test('CORS Vulnerability Check', async (t) => {
  // Test with an unauthorized origin
  const resEvil = await app.request('/health', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://evil.com',
      'Access-Control-Request-Method': 'GET'
    }
  }, { ENV: 'production' } as any);

  assert.strictEqual(resEvil.headers.get('Access-Control-Allow-Origin'), null, 'Should block unauthorized origin');

  // Test with an authorized origin
  const resGood = await app.request('/health', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://goldshore.ai',
      'Access-Control-Request-Method': 'GET'
    }
  }, { ENV: 'production' } as any);

  assert.strictEqual(resGood.headers.get('Access-Control-Allow-Origin'), 'https://goldshore.ai', 'Should allow authorized origin');

  // Test localhost in non-prod
  const resLocal = await app.request('/health', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'GET'
    }
  }, { ENV: 'development' } as any);

  assert.strictEqual(resLocal.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3000', 'Should allow localhost in dev');

  // Test localhost in prod (should be blocked)
  const resLocalProd = await app.request('/health', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'GET'
    }
  }, { ENV: 'production' } as any);

  assert.strictEqual(resLocalProd.headers.get('Access-Control-Allow-Origin'), null, 'Should block localhost in prod');
});
