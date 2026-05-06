import type { AnalysisProvider, AnalysisInput, AnalysisResponse, ProviderConfig } from './types';

const buildPrompt = (input: AnalysisInput) => {
  const parts = [] as string[];
  if (input.context && input.context.length > 0) {
    parts.push(input.context.join('\n'));
  }
  parts.push(input.prompt);
  return parts.join('\n');
};

export const geminiProvider: AnalysisProvider = {
  name: 'gemini',
  async analyze(input: AnalysisInput, config: ProviderConfig): Promise<AnalysisResponse> {
    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error('Gemini API key is missing');
    }

    const model = config.model ?? 'gemini-1.5-pro';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await config.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildPrompt(input) }],
          },
        ],
      }),
    });

    const payload = await response.json();
    const output = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return {
      provider: 'gemini',
      output,
      raw: payload,
    };
  },
};
