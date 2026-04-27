export type { AnalysisInput, AnalysisRequest, AnalysisResponse, AnalysisProvider, ProviderConfig, ProviderName } from './types';
export { applyAnalysisPolicy } from './policy';
export { openAIProvider } from './openai';
export { geminiProvider } from './gemini';

import type { AnalysisProvider, ProviderName } from './types';
import { openAIProvider } from './openai';
import { geminiProvider } from './gemini';

const providers: Record<ProviderName, AnalysisProvider> = {
  openai: openAIProvider,
  gemini: geminiProvider,
};

export const getProvider = (name: ProviderName) => providers[name];
