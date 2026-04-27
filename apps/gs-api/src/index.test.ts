import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import { isAllowedOrigin, isPreviewOrigin } from './index';

test('allows documented preview goldshore.ai origins', () => {
  assert.equal(isPreviewOrigin('https://feature-123-preview.goldshore.ai'), true);
  assert.equal(isAllowedOrigin('https://feature-123-preview.goldshore.ai'), true);
});

test('allows documented goldshore-pages.dev preview origins', () => {
  assert.equal(isPreviewOrigin('https://branch-name.goldshore-pages.dev'), true);
  assert.equal(isAllowedOrigin('https://branch-name.goldshore-pages.dev'), true);
});

test('rejects unrelated origins', () => {
  assert.equal(isAllowedOrigin('https://evil.example.com'), false);
});
