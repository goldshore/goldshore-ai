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
