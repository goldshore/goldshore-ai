import { InferenceClient } from '@huggingface/inference';
import type { AnalysisInput, AnalysisProvider, AnalysisResponse, ProviderConfig } from './types';

const messagesFor = (input: AnalysisInput) => [
  ...(input.context?.length
    ? [{ role: 'system' as const, content: input.context.join('\n') }]
    : []),
  { role: 'user' as const, content: input.prompt },
];

export const huggingFaceProvider: AnalysisProvider = {
  name: 'huggingface',
  async analyze(input: AnalysisInput, config: ProviderConfig): Promise<AnalysisResponse> {
    if (!config.apiKey) throw new Error('Hugging Face access token is missing');

    const client = new InferenceClient(config.apiKey, {
      ...(config.baseUrl ? { endpointUrl: config.baseUrl } : {}),
    });
    const result = await client.chatCompletion({
      model: config.model ?? 'Qwen/Qwen3-32B',
      messages: messagesFor(input),
      max_tokens: 1024,
    });

    return {
      provider: 'huggingface',
      output: result.choices[0]?.message?.content ?? '',
      raw: result,
    };
  },
};

