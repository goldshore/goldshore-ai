import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { callAnthropic } from './anthropic-provider';

const env = (fetchUrl: string[] = []) =>
  ({
    ENV: 'preview',
    ANTHROPIC_API_KEY: 'worker-secret',
    ANTHROPIC_GATEWAY_ID: 'goldshore-ai',
    AI: {
      gateway: () => ({
        getUrl: async (provider: string) => {
          fetchUrl.push(provider);
          return 'https://gateway.example/anthropic';
        },
      }),
    },
  }) as any;

describe('Anthropic provider adapter', () => {
  it('uses the Worker binding endpoint, redacts PII, and reports cost telemetry', async () => {
    const providers: string[] = [];
    let sent: any;
    const result = await callAnthropic(
      env(providers),
      {
        messages: [{ role: 'user', content: 'Email me at jane@example.com' }],
        tools: [
          {
            name: 'lookup',
            description: 'Look up a record',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      },
      {
        fetch: async (url, init) => {
          assert.equal(
            String(url),
            'https://gateway.example/anthropic/v1/messages',
          );
          assert.equal(
            new Headers(init?.headers).get('x-api-key'),
            'worker-secret',
          );
          sent = JSON.parse(String(init?.body));
          return new Response(
            JSON.stringify({
              id: 'msg_1',
              content: [{ type: 'text', text: 'done' }],
              usage: { input_tokens: 100, output_tokens: 20 },
            }),
            { status: 200 },
          );
        },
      },
    );
    assert.deepEqual(providers, ['anthropic']);
    assert.match(sent.messages[0].content, /<untrusted_user_input>/);
    assert.doesNotMatch(JSON.stringify(sent), /jane@example\.com/);
    assert.equal(result.tokensUsed.total, 120);
    assert.ok(result.telemetry.estimatedCostUsd > 0);
  });

  it('rejects unapproved models and malformed tool schemas before fetch', async () => {
    await assert.rejects(
      () =>
        callAnthropic(env(), {
          model: 'claude-unapproved',
          messages: [{ role: 'user', content: 'hello' }],
        }),
      /not allowed/,
    );
    await assert.rejects(
      () =>
        callAnthropic(env(), {
          messages: [{ role: 'user', content: 'hello' }],
          tools: [
            {
              name: 'lookup',
              description: 'Lookup',
              inputSchema: { type: 'string' },
            },
          ],
        }),
      /JSON Schema object/,
    );
  });

  it('fails closed outside preview when no gateway is configured', async () => {
    await assert.rejects(
      () =>
        callAnthropic(
          {
            ENV: 'production',
            ANTHROPIC_API_KEY: 'worker-secret',
          } as any,
          { messages: [{ role: 'user', content: 'hello' }] },
        ),
      /Verified Anthropic AI Gateway/,
    );
  });
});
