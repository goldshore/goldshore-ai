export type ProviderName = 'openai' | 'gemini';

export type AnalysisInput = {
  prompt: string;
  context?: string[];
  metadata?: Record<string, string | number | boolean | null>;
};

export type AnalysisRequest = {
  provider: ProviderName;
  input: AnalysisInput;
};

export type AnalysisResponse = {
  provider: ProviderName;
  output: string;
  raw?: unknown;
};

export type ProviderConfig = {
  fetch: typeof fetch;
  apiKey?: string;
  model?: string;
};

export interface AnalysisProvider {
  name: ProviderName;
  analyze(input: AnalysisInput, config: ProviderConfig): Promise<AnalysisResponse>;
}
