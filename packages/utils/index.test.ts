import { test, describe } from 'node:test';
import assert from 'node:assert';
import { json, parseJson } from './index';

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

  test('throws for circular references', () => {
    const circular: any = {};
    circular.self = circular;
    assert.throws(() => json(circular));
  });

  test('throws for BigInt', () => {
    assert.throws(() => json(BigInt(1)));
  });
});

describe('parseJson utility', () => {
  test('parses valid JSON string', () => {
    const jsonStr = '{"foo":"bar"}';
    const result = parseJson(jsonStr, {});
    assert.deepStrictEqual(result, { foo: 'bar' });
  });

  test('returns fallback for null input', () => {
    const fallback = { foo: 'fallback' };
    const result = parseJson(null, fallback);
    assert.deepStrictEqual(result, fallback);
  });

  test('returns fallback for undefined/empty string', () => {
    // Though type says string | null, JS runtime might pass undefined or empty string
    // The implementation checks `if (!value)` so empty string is covered.
    const fallback = { foo: 'fallback' };
    const result = parseJson('', fallback);
    assert.deepStrictEqual(result, fallback);
  });

  test('returns fallback for invalid JSON', () => {
    const jsonStr = 'invalid-json';
    const fallback = { foo: 'fallback' };
    const result = parseJson(jsonStr, fallback);
    assert.deepStrictEqual(result, fallback);
  });

  test('handles primitive JSON values', () => {
    const jsonStr = '123';
    const result = parseJson(jsonStr, 0);
    assert.strictEqual(result, 123);
  });

  test('returns fallback when JSON.parse returns null', () => {
    const jsonStr = 'null';
    const fallback = { foo: 'fallback' };
    const result = parseJson(jsonStr, fallback);
    assert.deepStrictEqual(result, fallback);
  });
});
