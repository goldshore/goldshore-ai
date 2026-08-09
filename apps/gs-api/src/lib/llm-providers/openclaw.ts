export interface LLMResponse {
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string;
  costImpact?: string;
  recommendations?: string[];
  confidence: number;
}

export interface LLMProvider {
  analyzeRisk(context: RiskAnalysisContext): Promise<LLMResponse>;
  estimateCosts(integrations: CostContext[]): Promise<CostRecommendation[]>;
  name: string;
  costPerToken: number;
}

export interface RiskAnalysisContext {
  integrationId: string;
  provider: string;
  operation: string;
  errorCount: number;
  uptime: number;
  recentErrors?: string[];
  isProduction: boolean;
  lastSyncAt?: string;
  rotationCount: number;
}

export interface CostContext {
  integrationId: string;
  provider: string;
  estimatedMonthlyCost: number;
  recentSpend?: number[];
  lastUpdate: string;
}

export interface CostRecommendation {
  integrationId: string;
  provider: string;
  recommendation: string;
  estimatedSavings: number;
  confidence: number;
}

class OpenClawProvider implements LLMProvider {
  name = 'openclaw';
  costPerToken: number;
  private apiUrl: string;
  private apiKey: string;

  constructor(apiUrl: string, apiKey: string, costPerToken: number = 0.0001) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.costPerToken = costPerToken;
  }

  async analyzeRisk(context: RiskAnalysisContext): Promise<LLMResponse> {
    try {
      const prompt = this.buildRiskAnalysisPrompt(context);
      const response = await this.callOpenClaw(prompt);
      return this.parseRiskResponse(response);
    } catch (error) {
      console.error('OpenClaw risk analysis failed:', error);
      throw new Error(`OpenClaw risk analysis failed: ${String(error)}`);
    }
  }

  async estimateCosts(integrations: CostContext[]): Promise<CostRecommendation[]> {
    try {
      const prompt = this.buildCostAnalysisPrompt(integrations);
      const response = await this.callOpenClaw(prompt);
      return this.parseCostResponse(response);
    } catch (error) {
      console.error('OpenClaw cost analysis failed:', error);
      return [];
    }
  }

  private buildRiskAnalysisPrompt(context: RiskAnalysisContext): string {
    return `Analyze the risk of this operation and respond in JSON format:

Integration: ${context.provider} (${context.integrationId})
Operation: ${context.operation}
Error Count (30d): ${context.errorCount}
Uptime: ${context.uptime.toFixed(1)}%
Production Account: ${context.isProduction}
Rotation Count: ${context.rotationCount}
Recent Errors: ${context.recentErrors?.join(', ') || 'none'}

Respond with JSON: { "riskLevel": "low|medium|high", "reasoning": "...", "costImpact": "...", "recommendations": [...], "confidence": 0.0-1.0 }`;
  }

  private buildCostAnalysisPrompt(integrations: CostContext[]): string {
    const integrationSummary = integrations
      .map((i) => `${i.provider}: $${i.estimatedMonthlyCost}/mo`)
      .join('\n');

    return `Analyze these integrations for cost optimization opportunities:

${integrationSummary}

For each, suggest alternatives or optimizations. Respond with JSON array: [{ "integrationId": "...", "provider": "...", "recommendation": "...", "estimatedSavings": 0-1000, "confidence": 0.0-1.0 }]`;
  }

  private async callOpenClaw(prompt: string): Promise<string> {
    const response = await fetch(`${this.apiUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openclaw-default',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenClaw API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    return data.content[0]?.text || '';
  }

  private parseRiskResponse(responseText: string): LLMResponse {
    try {
      const json = JSON.parse(responseText);
      return {
        riskLevel: json.riskLevel || 'medium',
        reasoning: json.reasoning || '',
        costImpact: json.costImpact,
        recommendations: json.recommendations || [],
        confidence: json.confidence || 0.5,
      };
    } catch {
      return {
        riskLevel: 'medium',
        reasoning: 'Failed to parse LLM response',
        confidence: 0,
      };
    }
  }

  private parseCostResponse(responseText: string): CostRecommendation[] {
    try {
      return JSON.parse(responseText);
    } catch {
      return [];
    }
  }
}

class ClaudeProvider implements LLMProvider {
  name = 'claude';
  costPerToken = 0.003; // Approximate for Claude 3.5 Sonnet
  private apiUrl: string;
  private apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  async analyzeRisk(context: RiskAnalysisContext): Promise<LLMResponse> {
    // Placeholder - would use Claude API
    return {
      riskLevel: 'medium',
      reasoning: 'Claude provider not implemented',
      confidence: 0,
    };
  }

  async estimateCosts(integrations: CostContext[]): Promise<CostRecommendation[]> {
    return [];
  }
}

class LocalRulesProvider implements LLMProvider {
  name = 'local-rules';
  costPerToken = 0;

  async analyzeRisk(context: RiskAnalysisContext): Promise<LLMResponse> {
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const reasoning: string[] = [];

    if (context.errorCount > 10 || context.uptime < 95) {
      riskLevel = 'high';
      reasoning.push('High error rate or low uptime detected');
    } else if (context.errorCount > 5 || context.uptime < 98) {
      riskLevel = 'medium';
      reasoning.push('Moderate error rate or uptime concerns');
    } else {
      reasoning.push('No recent errors, stable operation');
    }

    if (context.isProduction && context.rotationCount === 0) {
      reasoning.push('Production account with no prior rotations');
    }

    const recommendations = [];
    if (context.errorCount > 0) {
      recommendations.push(
        'Review recent errors before rotation to ensure stability'
      );
    }
    if (context.uptime < 99) {
      recommendations.push('Monitor closely for 24h post-rotation');
    }

    return {
      riskLevel,
      reasoning: reasoning.join('; '),
      recommendations,
      confidence: 0.7,
    };
  }

  async estimateCosts(integrations: CostContext[]): Promise<CostRecommendation[]> {
    return integrations
      .filter((i) => i.estimatedMonthlyCost > 100)
      .map((i) => ({
        integrationId: i.integrationId,
        provider: i.provider,
        recommendation: `High-cost integration (${i.provider}). Review usage patterns.`,
        estimatedSavings: i.estimatedMonthlyCost * 0.1,
        confidence: 0.5,
      }));
  }
}

export async function getLLMProvider(
  providerName?: string,
  config?: Record<string, string>
): Promise<LLMProvider> {
  const chosen = providerName || process.env.LLM_PROVIDER || 'local-rules';

  if (chosen === 'openclaw' && config?.['openclaw_url'] && config?.['openclaw_key']) {
    return new OpenClawProvider(
      config['openclaw_url'],
      config['openclaw_key'],
      parseFloat(config['openclaw_cost_per_token'] || '0.0001')
    );
  }

  if (chosen === 'claude' && config?.['claude_url'] && config?.['claude_key']) {
    return new ClaudeProvider(config['claude_url'], config['claude_key']);
  }

  return new LocalRulesProvider();
}
