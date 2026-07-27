import { InferenceClient } from '@huggingface/inference';
import type { AnalysisInput, AnalysisProvider, AnalysisResponse, ProviderConfig } from './types';

export const ollamaProvider: AnalysisProvider = {
  name: 'ollama',
  async analyze(input: AnalysisInput, config: ProviderConfig): Promise<AnalysisResponse> {
    const endpointUrl = config.baseUrl ?? 'http://127.0.0.1:11434/v1';
    const client = new InferenceClient(config.apiKey, { endpointUrl });
    const result = await client.chatCompletion({
      model: config.model ?? 'qwen3:0.6b',
      messages: [
        ...(input.context?.length
          ? [{ role: 'system' as const, content: input.context.join('\n') }]
          : []),
        { role: 'user' as const, content: input.prompt },
      ],
      max_tokens: 1024,
    });

    return {
      provider: 'ollama',
      output: result.choices[0]?.message?.content ?? '',
      raw: result,
    };
  },
};

