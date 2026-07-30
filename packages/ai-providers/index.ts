export type { AnalysisInput, AnalysisRequest, AnalysisResponse, AnalysisProvider, ProviderConfig, ProviderName } from './types';
export { applyAnalysisPolicy } from './policy';

import type { AnalysisProvider, ProviderName } from './types';
import { openAIProvider } from './openai';
import { geminiProvider } from './gemini';
import { huggingFaceProvider } from './huggingface';
import { ollamaProvider } from './ollama';

export { openAIProvider, geminiProvider, huggingFaceProvider, ollamaProvider };

const providers: Record<ProviderName, AnalysisProvider> = {
  openai: openAIProvider,
  gemini: geminiProvider,
  huggingface: huggingFaceProvider,
  ollama: ollamaProvider,
};

export const getProvider = (name: ProviderName) => providers[name];
