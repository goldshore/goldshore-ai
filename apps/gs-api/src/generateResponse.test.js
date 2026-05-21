import assert from 'node:assert/strict';
import test from 'node:test';

import { generateResponse } from './generateResponse.js';
import { resetAIClientForTests } from './aiClient.js';

test('generateResponse validates prompt', async () => {
  await assert.rejects(() => generateResponse(''), /prompt must be a non-empty string/);
});

test('generateResponse returns helpful env error when config is missing', async () => {
  const previousToken = process.env.CF_AIG_TOKEN;
  const previousUrl = process.env.CF_GATEWAY_URL;

  delete process.env.CF_AIG_TOKEN;
  delete process.env.CF_GATEWAY_URL;
  resetAIClientForTests();

  try {
    await assert.rejects(() => generateResponse('Hello world'), /Missing AI Gateway configuration/);
  } finally {
    if (previousToken === undefined) {
      delete process.env.CF_AIG_TOKEN;
    } else {
      process.env.CF_AIG_TOKEN = previousToken;
    }

    if (previousUrl === undefined) {
      delete process.env.CF_GATEWAY_URL;
    } else {
      process.env.CF_GATEWAY_URL = previousUrl;
    }

    resetAIClientForTests();
  }
});
