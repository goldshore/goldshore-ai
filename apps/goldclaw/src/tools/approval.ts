import { GoldShoreClient } from '../lib/goldshore-client';

export interface TokenRotationRequest {
  secretId: string;
  integrationId: string;
  provider: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ApprovalContext {
  recentErrorCount: number;
  uptime: string;
  lastSyncTime?: string;
  operationTimelineMinutes: number;
}

/**
 * Validate OAuth credentials before attempting rotation
 */
export async function validateOAuthCredentials(
  client: GoldShoreClient,
  integrationId: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const secrets = await client.getSecrets(integrationId);
    const oauthToken = secrets.find((s) => s.keyType === 'oauth_token');

    if (!oauthToken) {
      return { valid: false, error: 'No OAuth token found' };
    }

    const result = await client.verifySecret(oauthToken.id);
    return {
      valid: result.valid,
      error: result.valid ? undefined : 'Token verification failed',
    };
  } catch (error) {
    return {
      valid: false,
      error: String(error),
    };
  }
}

/**
 * Trigger token rotation (executes after approval)
 */
export async function triggerTokenRotation(
  client: GoldShoreClient,
  secretId: string,
  newToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await client.rotateSecret(secretId, newToken);

    await client.logAdminAction({
      action: 'goldclaw.token_rotation',
      status: 'success',
      metadata: {
        secret_id: secretId,
        timestamp: new Date().toISOString(),
      },
    });

    return { success: true };
  } catch (error) {
    await client.logAdminAction({
      action: 'goldclaw.token_rotation',
      status: 'error',
      metadata: {
        secret_id: secretId,
        error: String(error),
      },
    });

    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Request token rotation approval via WhatsApp with risk assessment
 */
export async function requestTokenRotationApproval(
  client: GoldShoreClient,
  request: TokenRotationRequest,
  context: ApprovalContext
): Promise<{ queueId: string }> {
  const riskEmoji =
    request.riskLevel === 'low'
      ? '✅'
      : request.riskLevel === 'medium'
        ? '⚠️'
        : '🚩';

  const message = `🔑 ${request.provider.toUpperCase()} Token Rotation
Status: ${context.uptime} uptime (${context.recentErrorCount} errors in 30d)
Risk Level: ${request.riskLevel} ${riskEmoji}
Execution Time: ~${context.operationTimelineMinutes}s

React ✅ to approve or ❌ to skip`;

  const result = await client.queueCommand({
    command: `rotate-${request.provider}`,
    metadata: {
      secret_id: request.secretId,
      integration_id: request.integrationId,
      risk_level: request.riskLevel,
      uptime: context.uptime,
      error_count: context.recentErrorCount,
    },
    approval_method: 'whatsapp_reaction',
    message,
  });

  return result;
}

/**
 * Extend token expiry without rotating (useful for tokens with long refresh cycles)
 */
export async function extendTokenExpiry(
  client: GoldShoreClient,
  secretId: string,
  additionalDays: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date();
    const newExpiry = new Date(now.getTime() + additionalDays * 24 * 60 * 60 * 1000);

    await client.logAdminAction({
      action: 'goldclaw.token_expiry_extension',
      status: 'success',
      metadata: {
        secret_id: secretId,
        days_extended: additionalDays,
        new_expiry: newExpiry.toISOString(),
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Analyze operation risk based on historical patterns
 */
export function assessOperationRisk(context: ApprovalContext): 'low' | 'medium' | 'high' {
  // High risk: recent errors (>10% error rate) or low uptime (<95%)
  if (context.recentErrorCount > 5 || context.uptime.includes('9') === false) {
    return 'high';
  }

  // Medium risk: some errors but stable
  if (context.recentErrorCount > 0) {
    return 'medium';
  }

  // Low risk: no recent errors, high uptime
  return 'low';
}

/**
 * Assess operation risk with optional LLM analysis
 */
export async function assessOperationRiskWithLLM(
  context: ApprovalContext,
  lmmProvider?: any
): Promise<EnhancedRiskAssessment> {
  // Fallback: local rules engine if LLM not available
  const baseRiskLevel = assessOperationRisk(context);

  if (!lmmProvider) {
    return {
      riskLevel: baseRiskLevel,
      reasoning: `Base risk assessment: ${baseRiskLevel}. ${context.recentErrorCount} errors, ${context.uptime} uptime.`,
      recommendations: generateRiskRecommendations(baseRiskLevel, context),
      lmmConfidence: 0.7,
      usedLLM: false,
    };
  }

  try {
    const lmmResponse: any = await lmmProvider.analyzeRisk({
      errorCount: context.recentErrorCount,
      uptime: parseFloat(context.uptime.split('%')[0]),
      isProduction: context.isProduction ?? false,
      rotationCount: context.rotationCount ?? 0,
      recentErrors: context.recentErrors ?? [],
      operation: 'token_rotation',
    });

    return {
      riskLevel: lmmResponse.riskLevel,
      reasoning: lmmResponse.reasoning,
      costImpact: lmmResponse.costImpact,
      recommendations: lmmResponse.recommendations || generateRiskRecommendations(lmmResponse.riskLevel, context),
      lmmConfidence: lmmResponse.confidence || 0.8,
      usedLLM: true,
    };
  } catch (error) {
    console.error('LLM risk analysis failed, falling back to local rules:', error);
    return {
      riskLevel: baseRiskLevel,
      reasoning: `Local assessment (LLM failed): ${baseRiskLevel}. ${context.recentErrorCount} errors, ${context.uptime} uptime.`,
      recommendations: generateRiskRecommendations(baseRiskLevel, context),
      lmmConfidence: 0.5,
      usedLLM: false,
    };
  }
}

/**
 * Generate contextual recommendations based on risk level
 */
function generateRiskRecommendations(
  riskLevel: 'low' | 'medium' | 'high',
  context: ApprovalContext
): string[] {
  const recs: string[] = [];

  if (riskLevel === 'high') {
    recs.push('Review recent errors and resolve critical issues before rotation.');
    if (context.recentErrorCount > 10) {
      recs.push('Error rate is elevated. Consider scheduling rotation during low-traffic window.');
    }
  } else if (riskLevel === 'medium') {
    recs.push('Rotation is safe but monitor for 24h post-completion.');
    if (context.operationTimelineMinutes > 2) {
      recs.push('Execution time is longer than usual. Plan for potential brief service disruption.');
    }
  } else {
    recs.push('All metrics green. Safe to proceed immediately.');
  }

  if (context.isProduction && (context.rotationCount ?? 0) === 0) {
    recs.push('This is the first rotation on a production integration. Extra caution recommended.');
  }

  return recs.slice(0, 4);
}

/**
 * Generate human-readable approval summary
 */
export function generateApprovalSummary(
  provider: string,
  context: ApprovalContext,
  riskLevel: 'low' | 'medium' | 'high'
): string {
  const riskEmoji =
    riskLevel === 'low' ? '✅' : riskLevel === 'medium' ? '⚠️' : '🚩';

  return `
**${provider.toUpperCase()} Token Rotation Request**
Risk Level: ${riskLevel} ${riskEmoji}
Recent Uptime: ${context.uptime}
Errors (30d): ${context.recentErrorCount}
Estimated Execution Time: ${context.operationTimelineMinutes}s

This is an ${riskLevel}-risk operation.
${riskLevel === 'high' ? 'Proceed with caution.' : riskLevel === 'medium' ? 'Proceed with normal care.' : 'Safe to proceed.'}
  `.trim();
}
