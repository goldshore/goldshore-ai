/**
 * LLM Abstraction Layer
 * Supports: Claude, OpenAI, openclaw (self-hosted)
 * Swap providers without changing business logic
 */

import { callAnthropic } from './anthropic-provider';
import type { Env } from '../types';

export type LLMProvider = 'claude' | 'openai' | 'openclaw' | 'local';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl?: string; // For self-hosted (openclaw, local LLM)
  model: string;
  temperature?: number;
  maxTokens?: number;
  env?: Env;
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
  telemetry?: {
    durationMs: number;
    attempts: number;
    estimatedCostUsd: number;
  };
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
    if (!this.config.env)
      throw new Error('Claude calls require the gs-api runtime environment');
    const data = await callAnthropic(this.config.env, {
      messages: request.messages,
      model: this.config.model,
      maxTokens: request.maxTokens ?? this.config.maxTokens,
      temperature: request.temperature ?? this.config.temperature,
      tools: request.tools,
    });

    return {
      id: data.id,
      content: data.content,
      tokensUsed: data.tokensUsed,
      model: data.model,
      provider: 'claude',
      toolCalls: data.toolCalls,
      telemetry: data.telemetry,
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

  private async completeWithSelfHosted(
    request: LLMRequest,
  ): Promise<LLMResponse> {
    // Support for openclaw, local llama, ollama, etc.
    const baseUrl = this.config.baseUrl || 'http://localhost:8000';
    const endpoint = `${baseUrl}/v1/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && {
          Authorization: `Bearer ${this.config.apiKey}`,
        }),
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
        `Self-hosted LLM error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    return {
      id: data.id || `${Date.now()}`,
      content: data.choices[0]?.message?.content || '',
      tokensUsed: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total:
          (data.usage?.prompt_tokens || 0) +
          (data.usage?.completion_tokens || 0),
      },
      model: this.config.model,
      provider: this.provider,
    };
  }
}

export type LLMEnvironment = Record<string, unknown>;

const getEnvString = (env: LLMEnvironment, key: string): string | undefined => {
  const value = env[key];
  return typeof value === 'string' ? value : undefined;
};

export const getLLMConfig = (env: LLMEnvironment): LLMConfig => {
  const provider = (getEnvString(env, 'LLM_PROVIDER') ||
    'claude') as LLMProvider;
  const apiKey = getProviderApiKey(provider, env);
  const baseUrl = getProviderBaseUrl(provider, env);

  return {
    provider,
    apiKey,
    baseUrl,
    model: getEnvString(env, 'LLM_MODEL') || getDefaultModel(provider),
    temperature: parseFloat(getEnvString(env, 'LLM_TEMPERATURE') || '0.7'),
    maxTokens: parseInt(getEnvString(env, 'LLM_MAX_TOKENS') || '2048', 10),
    env: env as Env,
  };
};

export const getRedactedLLMConfig = (
  env: LLMEnvironment,
): Omit<LLMConfig, 'apiKey'> & { hasApiKey: boolean } => {
  const config = getLLMConfig(env);
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    hasApiKey: Boolean(config.apiKey),
  };
};

const getProviderApiKey = (
  provider: LLMProvider,
  env: LLMEnvironment,
): string => {
  // Check provider-specific env var first, fall back to generic LLM_API_KEY
  switch (provider) {
    case 'claude':
      return (
        getEnvString(env, 'ANTHROPIC_API_KEY') ||
        getEnvString(env, 'LLM_API_KEY') ||
        ''
      );
    case 'openai':
      return (
        getEnvString(env, 'OPENAI_API_KEY') ||
        getEnvString(env, 'LLM_API_KEY') ||
        ''
      );
    case 'openclaw':
      return (
        getEnvString(env, 'OPENCLAW_API_KEY') ||
        getEnvString(env, 'LLM_API_KEY') ||
        ''
      );
    case 'local':
      return (
        getEnvString(env, 'LOCAL_LLM_API_KEY') ||
        getEnvString(env, 'LLM_API_KEY') ||
        ''
      );
    default:
      return getEnvString(env, 'LLM_API_KEY') || '';
  }
};

const getProviderBaseUrl = (
  provider: LLMProvider,
  env: LLMEnvironment,
): string | undefined => {
  // Self-hosted deployments need base URL
  switch (provider) {
    case 'openclaw':
      return (
        getEnvString(env, 'OPENCLAW_BASE_URL') ||
        getEnvString(env, 'LLM_BASE_URL')
      );
    case 'local':
      return (
        getEnvString(env, 'LOCAL_LLM_BASE_URL') ||
        getEnvString(env, 'LLM_BASE_URL')
      );
    default:
      return getEnvString(env, 'LLM_BASE_URL');
  }
};

const getDefaultModel = (provider: LLMProvider): string => {
  const defaults: Record<LLMProvider, string> = {
    claude: 'claude-sonnet-4-5',
    openai: 'gpt-4-turbo',
    openclaw: 'openclaw',
    local: 'local-model',
  };
  return defaults[provider];
};
