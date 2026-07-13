/**
 * Admin-facing LLM API client.
 *
 * Provider credentials, routing, and execution live in gs-api. This client only
 * calls the authenticated gs-api LLM endpoint so admin UI code cannot bypass the
 * central auth/audit/control layer.
 */

export type LLMProvider = 'claude' | 'openai' | 'openclaw' | 'local';

export interface LLMConfig {
  provider: LLMProvider;
  apiBaseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
}

export interface LLMResponse {
  id: string;
  content: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  provider: LLMProvider;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

export class LLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const apiBaseUrl = this.config.apiBaseUrl || '/api';
    const response = await fetch(`${apiBaseUrl}/ai/llm/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`gs-api LLM error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

export const getLLMConfig = (): LLMConfig => ({
  provider: 'claude',
  apiBaseUrl: import.meta.env.PUBLIC_GS_API_URL || 'https://api.goldshore.ai',
  model: 'configured-by-gs-api',
});
