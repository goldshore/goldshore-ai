import { describe, test, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { geminiProvider } from './gemini';
import type { AnalysisInput, ProviderConfig } from './types';

describe('geminiProvider', () => {
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
      async () => await geminiProvider.analyze(input, config),
      {
        message: 'Gemini API key is missing',
      }
    );
  });

  test('calls Gemini API with correct parameters and default model', async () => {
    const input: AnalysisInput = { prompt: 'Hello AI' };
    const config: ProviderConfig = {
      fetch: mockFetch,
      apiKey: 'test-api-key',
    };

    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Hello human' }],
          },
        },
      ],
    };

    mockFetch.mock.mockImplementation(async () => {
      return {
        json: async () => mockResponse,
      };
    });

    const result = await geminiProvider.analyze(input, config);

    // Verify fetch call
    assert.strictEqual(mockFetch.mock.callCount(), 1);
    const call = mockFetch.mock.calls[0];

    // Check URL
    assert.strictEqual(call.arguments[0], 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=test-api-key');

    // Check Options
    const options = call.arguments[1];
    assert.strictEqual(options.method, 'POST');
    assert.deepStrictEqual(options.headers, {
      'Content-Type': 'application/json',
    });

    // Check Body
    const body = JSON.parse(options.body);
    assert.deepStrictEqual(body.contents, [
      { role: 'user', parts: [{ text: 'Hello AI' }] },
    ]);

    // Verify result
    assert.deepStrictEqual(result, {
      provider: 'gemini',
      output: 'Hello human',
      raw: mockResponse,
    });
  });

  test('uses provided model if specified', async () => {
    const input: AnalysisInput = { prompt: 'test' };
    const config: ProviderConfig = {
      fetch: mockFetch,
      apiKey: 'key',
      model: 'gemini-2.0-flash',
    };

    mockFetch.mock.mockImplementation(async () => ({
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
    }));

    await geminiProvider.analyze(input, config);

    const call = mockFetch.mock.calls[0];
    assert.strictEqual(call.arguments[0], 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=key');
  });

  test('includes context in prompt', async () => {
    const input: AnalysisInput = {
      prompt: 'Summarize this',
      context: ['Context 1', 'Context 2'],
    };
    const config: ProviderConfig = {
      fetch: mockFetch,
      apiKey: 'key',
    };

    mockFetch.mock.mockImplementation(async () => ({
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
    }));

    await geminiProvider.analyze(input, config);

    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call.arguments[1].body);

    assert.deepStrictEqual(body.contents, [
      { role: 'user', parts: [{ text: 'Context 1\nContext 2\nSummarize this' }] },
    ]);
  });

  test('handles empty response gracefully', async () => {
    const input: AnalysisInput = { prompt: 'test' };
    const config: ProviderConfig = {
      fetch: mockFetch,
      apiKey: 'test-api-key',
    };

    const mockResponse = {}; // Empty response without candidates

    mockFetch.mock.mockImplementation(async () => {
      return {
        json: async () => mockResponse,
      };
    });

    const result = await geminiProvider.analyze(input, config);

    // Verify result
    assert.deepStrictEqual(result, {
      provider: 'gemini',
      output: '',
      raw: mockResponse,
    });
  });
});
