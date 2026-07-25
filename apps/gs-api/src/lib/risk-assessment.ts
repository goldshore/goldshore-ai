/**
 * Risk Assessment Engine
 * Analyzes integration commands for risk level before approval
 * Used by nanny mode to provide confidence assessments to admins
 */

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskAssessment {
  riskLevel: RiskLevel;
  confidenceScore: number; // 0-100
  riskFactors: Array<{
    type: string;
    description: string;
    weight: number; // Contribution to risk score
  }>;
  recommendations: string[];
  safeToAutoApprove: boolean;
}

export interface CommandContext {
  action: string;
  actor: string;
  integrationId: string;
  provider: string;
  recentErrorCount?: number;
  uptime?: number; // Percentage (0-100)
  lastSyncHours?: number;
  monthlySpend?: number;
  isProductionAccount?: boolean;
  tokenRotationCount?: number;
  tokenAgeHours?: number;
}

/**
 * Assess risk for a command before approval
 */
export function assessCommandRisk(context: CommandContext): RiskAssessment {
  const riskFactors: RiskAssessment['riskFactors'] = [];
  let totalWeight = 0;
  let totalRisk = 0;

  // Production account risk
  if (context.isProductionAccount) {
    riskFactors.push({
      type: 'production_account',
      description: 'Command affects production integration',
      weight: 20,
    });
    totalRisk += 20;
    totalWeight += 20;
  }

  // Recent errors
  if ((context.recentErrorCount || 0) > 3) {
    riskFactors.push({
      type: 'recent_errors',
      description: `Integration has ${context.recentErrorCount} recent errors`,
      weight: 15,
    });
    totalRisk += 15;
    totalWeight += 15;
  }

  // Low uptime
  if ((context.uptime || 100) < 90) {
    riskFactors.push({
      type: 'low_uptime',
      description: `Integration uptime is ${context.uptime}%`,
      weight: 15,
    });
    totalRisk += 15;
    totalWeight += 15;
  }

  // Token rotation action
  if (context.action === 'rotate_token') {
    // Routine token rotations are low risk
    if ((context.tokenRotationCount || 0) > 10) {
      riskFactors.push({
        type: 'excessive_rotations',
        description: `Token has been rotated ${context.tokenRotationCount} times (may indicate instability)`,
        weight: 10,
      });
      totalRisk += 10;
    } else {
      // Typical rotation, low risk
      riskFactors.push({
        type: 'routine_maintenance',
        description: 'Token rotation is routine maintenance',
        weight: -5, // Negative weight = reduces risk
      });
      totalRisk -= 5;
    }
    totalWeight += 5;
  }

  // Budget change action
  if (context.action === 'update_budget') {
    if ((context.monthlySpend || 0) > 10000) {
      riskFactors.push({
        type: 'high_spend_account',
        description: `Account has high monthly spend ($${context.monthlySpend})`,
        weight: 20,
      });
      totalRisk += 20;
      totalWeight += 20;
    }
  }

  // Stale integration
  if ((context.lastSyncHours || 0) > 48) {
    riskFactors.push({
      type: 'stale_integration',
      description: `Integration hasn't synced in ${context.lastSyncHours} hours`,
      weight: 10,
    });
    totalRisk += 10;
    totalWeight += 10;
  }

  // Normalize risk score to 0-100
  const riskScore = totalWeight > 0 ? Math.min(100, (totalRisk / totalWeight) * 100) : 0;

  const riskLevel: RiskLevel = riskScore < 30 ? 'low' : riskScore < 70 ? 'medium' : 'high';

  const recommendations = generateRecommendations(context, riskLevel, riskFactors);
  const safeToAutoApprove = riskLevel === 'low' && (context.recentErrorCount || 0) === 0;

  return {
    riskLevel,
    confidenceScore: Math.round(riskScore),
    riskFactors,
    recommendations,
    safeToAutoApprove,
  };
}

/**
 * Generate recommendations based on risk assessment
 */
function generateRecommendations(
  context: CommandContext,
  riskLevel: RiskLevel,
  riskFactors: RiskAssessment['riskFactors']
): string[] {
  const recommendations: string[] = [];

  if (riskLevel === 'high') {
    recommendations.push('⚠️ High-risk operation — wait for manual approval from senior admin');
    recommendations.push('Consider postponing if not time-critical');
  }

  if (riskLevel === 'medium') {
    recommendations.push('⚠️ Medium-risk operation — recommended to wait for approval');
  }

  if (riskLevel === 'low') {
    recommendations.push('✅ Low-risk operation — safe to auto-approve if needed');
  }

  // Specific recommendations based on factors
  const hasProductionRisk = riskFactors.some((f) => f.type === 'production_account');
  if (hasProductionRisk) {
    recommendations.push('Ensure backup/rollback plan exists for production account');
  }

  const hasErrors = riskFactors.some((f) => f.type === 'recent_errors');
  if (hasErrors) {
    recommendations.push('Review recent error logs before proceeding');
  }

  const hasHighSpend = riskFactors.some((f) => f.type === 'high_spend_account');
  if (hasHighSpend) {
    recommendations.push('Double-check budget changes on high-spend accounts');
  }

  return recommendations.slice(0, 3); // Limit to 3 recommendations
}

/**
 * Generate WhatsApp message for nanny mode
 */
export function buildNannyModeWhatsAppMessage(
  commandId: string,
  context: CommandContext,
  assessment: RiskAssessment
): string {
  const emoji = {
    low: '✅',
    medium: '⚠️',
    high: '🚩',
  }[assessment.riskLevel];

  const lines = [
    `${emoji} ${context.action.toUpperCase()} — ${context.provider.toUpperCase()}`,
    `Integration: ${context.integrationId}`,
    `Risk: ${assessment.riskLevel} (${assessment.confidenceScore}% confidence)`,
    ``,
    ...assessment.recommendations.slice(0, 2),
    ``,
    `React ✅ to approve, ❌ to reject (timeout: 10 min)`,
    `Command ID: ${commandId}`,
  ];

  return lines.join('\n');
}
