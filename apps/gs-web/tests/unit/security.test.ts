import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import { escapeHtml, isValidEmail, sanitizeInput } from '../../src/utils/security.ts';

// escapeHtml

test('escapeHtml escapes ampersands', () => {
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
});

test('escapeHtml escapes less-than and greater-than characters', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
});

test('escapeHtml escapes double quotes', () => {
  assert.equal(escapeHtml('"hello"'), '&quot;hello&quot;');
});

test('escapeHtml escapes single quotes', () => {
  assert.equal(escapeHtml("it's"), 'it&#039;s');
});

test('escapeHtml returns empty string for empty input', () => {
  assert.equal(escapeHtml(''), '');
});

test('escapeHtml does not alter plain text with no special characters', () => {
  assert.equal(escapeHtml('hello world'), 'hello world');
});

// isValidEmail

test('isValidEmail returns true for a standard valid email', () => {
  assert.equal(isValidEmail('user@example.com'), true);
});

test('isValidEmail returns true for an email with a subdomain', () => {
  assert.equal(isValidEmail('user@mail.example.com'), true);
});

test('isValidEmail returns false for an address missing the @ symbol', () => {
  assert.equal(isValidEmail('userexample.com'), false);
});

test('isValidEmail returns false for an address missing the domain', () => {
  assert.equal(isValidEmail('user@'), false);
});

test('isValidEmail returns false for an address with spaces', () => {
  assert.equal(isValidEmail('user @example.com'), false);
});

test('isValidEmail returns false for an empty string', () => {
  assert.equal(isValidEmail(''), false);
});

// sanitizeInput

test('sanitizeInput trims leading and trailing whitespace', () => {
  assert.equal(sanitizeInput('  hello  '), 'hello');
});

test('sanitizeInput escapes HTML in the trimmed string', () => {
  assert.equal(sanitizeInput('  <b>hi</b>  '), '&lt;b&gt;hi&lt;/b&gt;');
});

test('sanitizeInput returns empty string for non-string input', () => {
  // @ts-expect-error testing runtime behaviour with wrong type
  assert.equal(sanitizeInput(42), '');
});

test('sanitizeInput returns empty string for null input', () => {
  // @ts-expect-error testing runtime behaviour with wrong type
  assert.equal(sanitizeInput(null), '');
});

test('sanitizeInput handles an already-clean string with no changes', () => {
  assert.equal(sanitizeInput('hello'), 'hello');
});
