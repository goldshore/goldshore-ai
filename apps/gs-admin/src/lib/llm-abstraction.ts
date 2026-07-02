/**
 * LLM Abstraction Layer
 * Supports: Claude, OpenAI, openclaw (self-hosted)
 * Swap providers without changing business logic
 */

export type LLMProvider = 'claude' | 'openai' | 'openclaw' | 'local';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl?: string; // For self-hosted (openclaw, local LLM)
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
  private provider: LLMProvider;

  constructor(config: LLMConfig) {
    this.config = config;
    this.provider = config.provider;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    switch (this.provider) {
      case 'claude':
        return this.completeWithClaude(request);
      case 'openai':
        return this.completeWithOpenAI(request);
      case 'openclaw':
      case 'local':
        return this.completeWithSelfHosted(request);
      default:
        throw new Error(`Unsupported LLM provider: ${this.provider}`);
    }
  }

  private async completeWithClaude(request: LLMRequest): Promise<LLMResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-opus-4-1',
        max_tokens: this.config.maxTokens || 2048,
        temperature: this.config.temperature || 0.7,
        messages: request.messages,
        tools: request.tools?.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
    }

    const data = await response.json();
    const textContent = data.content.find(
      (c: Record<string, unknown>) => c.type === 'text'
    );

    return {
      id: data.id,
      content: textContent?.text || '',
      tokensUsed: {
        prompt: data.usage.input_tokens,
        completion: data.usage.output_tokens,
        total: data.usage.input_tokens + data.usage.output_tokens,
      },
      model: this.config.model || 'claude-opus-4-1',
      provider: 'claude',
    };
  }

  private async completeWithOpenAI(request: LLMRequest): Promise<LLMResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4-turbo',
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2048,
        messages: request.messages,
        tools: request.tools?.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      id: data.id,
      content: data.choices[0]?.message?.content || '',
      tokensUsed: {
        prompt: data.usage.prompt_tokens,
        completion: data.usage.completion_tokens,
        total: data.usage.total_tokens,
      },
      model: this.config.model || 'gpt-4-turbo',
      provider: 'openai',
    };
  }

  private async completeWithSelfHosted(request: LLMRequest): Promise<LLMResponse> {
    // Support for openclaw, local llama, ollama, etc.
    const baseUrl = this.config.baseUrl || 'http://localhost:8000';
    const endpoint = `${baseUrl}/v1/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2048,
        messages: request.messages,
        tools: request.tools?.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Self-hosted LLM error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    return {
      id: data.id || `${Date.now()}`,
      content: data.choices[0]?.message?.content || '',
      tokensUsed: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total: (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0),
      },
      model: this.config.model,
      provider: this.provider,
    };
  }
}

export const getLLMConfig = (): LLMConfig => {
  const provider = (process.env.LLM_PROVIDER || 'claude') as LLMProvider;

  return {
    provider,
    apiKey: process.env.LLM_API_KEY || '',
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL || getDefaultModel(provider),
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '2048', 10),
  };
};

const getDefaultModel = (provider: LLMProvider): string => {
  const defaults: Record<LLMProvider, string> = {
    claude: 'claude-opus-4-1',
    openai: 'gpt-4-turbo',
    openclaw: 'openclaw',
    local: 'local-model',
  };
  return defaults[provider];
};
