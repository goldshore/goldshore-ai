import type { AnalysisProvider, AnalysisInput, AnalysisResponse, ProviderConfig } from './types';

const buildMessages = (input: AnalysisInput) => {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

  if (input.context && input.context.length > 0) {
    messages.push({ role: 'system', content: input.context.join('\n') });
  }

  messages.push({ role: 'user', content: input.prompt });
  return messages;
};

export const openAIProvider: AnalysisProvider = {
  name: 'openai',
  async analyze(input: AnalysisInput, config: ProviderConfig): Promise<AnalysisResponse> {
    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key is missing');
    }

    const model = config.model ?? 'gpt-4o-mini';
    const response = await config.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(input),
      }),
    });

    const payload = await response.json();
    const output = payload?.choices?.[0]?.message?.content ?? '';

    return {
      provider: 'openai',
      output,
      raw: payload,
    };
  },
};
