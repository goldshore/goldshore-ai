import { test, describe } from 'node:test';
import assert from 'node:assert';
import { json } from './index';

describe('json utility', () => {
  test('returns 200 OK by default', async () => {
    const data = { foo: 'bar' };
    const response = json(data);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('Content-Type'), 'application/json');

    const body = await response.json();
    assert.deepStrictEqual(body, data);
  });

  test('returns custom status code', async () => {
    const data = { error: 'Bad Request' };
    const response = json(data, 400);

    assert.strictEqual(response.status, 400);

    const body = await response.json();
    assert.deepStrictEqual(body, data);
  });

  test('handles primitive values', async () => {
    const response = json(123);
    const body = await response.json();
    assert.strictEqual(body, 123);
  });

  test('handles null', async () => {
    const response = json(null);
    const body = await response.json();
    assert.strictEqual(body, null);
  });
});
