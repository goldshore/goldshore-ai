import { describe, test, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { openAIProvider } from './openai';
import type { AnalysisInput, ProviderConfig } from './types';

describe('openAIProvider', () => {
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = mock.fn();
  });

  test('throws error if API key is missing', async () => {
    const input: AnalysisInput = { prompt: 'test' };
    const config: ProviderConfig = {
      fetch: mockFetch,
      apiKey: undefined,
    };

    await assert.rejects(
      async () => await openAIProvider.analyze(input, config),
      {
        message: 'OpenAI API key is missing',
      }
    );
  });

  test('calls OpenAI API with correct parameters and default model', async () => {
    const input: AnalysisInput = { prompt: 'Hello AI' };
    const config: ProviderConfig = {
      fetch: mockFetch,
      apiKey: 'test-api-key',
    };

    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Hello human',
          },
        },
      ],
    };

    mockFetch.mock.mockImplementation(async () => {
      return {
        json: async () => mockResponse,
      };
    });

    const result = await openAIProvider.analyze(input, config);

    // Verify fetch call
    assert.strictEqual(mockFetch.mock.callCount(), 1);
    const call = mockFetch.mock.calls[0];

    // Check URL
    assert.strictEqual(call.arguments[0], 'https://api.openai.com/v1/chat/completions');

    // Check Options
    const options = call.arguments[1];
    assert.strictEqual(options.method, 'POST');
    assert.deepStrictEqual(options.headers, {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-api-key',
    });

    // Check Body
    const body = JSON.parse(options.body);
    assert.strictEqual(body.model, 'gpt-4o-mini');
    assert.deepStrictEqual(body.messages, [
      { role: 'user', content: 'Hello AI' },
    ]);

    // Verify result
    assert.deepStrictEqual(result, {
      provider: 'openai',
      output: 'Hello human',
      raw: mockResponse,
    });
  });

  test('uses provided model if specified', async () => {
    const input: AnalysisInput = { prompt: 'test' };
    const config: ProviderConfig = {
      fetch: mockFetch,
      apiKey: 'key',
      model: 'gpt-4-turbo',
    };

    mockFetch.mock.mockImplementation(async () => ({
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    }));

    await openAIProvider.analyze(input, config);

    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call.arguments[1].body);
    assert.strictEqual(body.model, 'gpt-4-turbo');
  });

  test('includes context in messages', async () => {
    const input: AnalysisInput = {
      prompt: 'Summarize this',
      context: ['Context 1', 'Context 2'],
    };
    const config: ProviderConfig = {
      fetch: mockFetch,
      apiKey: 'key',
    };

    mockFetch.mock.mockImplementation(async () => ({
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    }));

    await openAIProvider.analyze(input, config);

    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call.arguments[1].body);

    assert.deepStrictEqual(body.messages, [
      { role: 'system', content: 'Context 1\nContext 2' },
      { role: 'user', content: 'Summarize this' },
    ]);
  });
});
