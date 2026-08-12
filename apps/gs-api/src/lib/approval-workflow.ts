/**
 * Approval Workflow Orchestrator
 * Coordinates command approval via manual UI, WhatsApp nanny mode, or auto-approval
 * Integrates risk assessment to provide confidence guidance to admins
 */

import type { Env } from '../types';
import { assessCommandRisk, buildNannyModeWhatsAppMessage, type CommandContext } from './risk-assessment';
import { getCommandStatus, markCommandExecuted, markCommandFailed, approveCommand } from './command-queue';
import { logAdminAction } from '../auth';

export interface ApprovalWorkflowConfig {
  commandId: string;
  actor: string;
  action: string;
  integrationId: string;
  provider: string;
  approvalMethod: 'manual_ui' | 'whatsapp_reaction' | 'auto';
}

/**
 * Process command with risk assessment and nanny mode
 */
export async function processCommandWithRiskAssessment(
  env: Env,
  config: ApprovalWorkflowConfig,
  context: CommandContext
) {
  // Assess risk
  const risk = assessCommandRisk(context);

  // Update command metadata with risk assessment
  const command = await getCommandStatus(env, config.commandId);
  if (!command) {
    throw new Error('Command not found');
  }

  // Store risk assessment metadata
  const commandKey = `cmd:${config.commandId}`;
  const updatedCommand = {
    ...command,
    risk_assessment: risk,
    risk_level: risk.riskLevel,
    confidence_score: risk.confidenceScore,
  };

  await env.KV.put(commandKey, JSON.stringify(updatedCommand), { expirationTtl: 86400 });

  // Route based on approval method
  switch (config.approvalMethod) {
    case 'whatsapp_reaction':
      return handleWhatsAppNannyMode(env, config, risk);

    case 'manual_ui':
      return handleManualUIApproval(env, config, risk);

    case 'auto':
      return handleAutoApproval(env, config, risk);

    default:
      throw new Error('Invalid approval method');
  }
}

/**
 * WhatsApp nanny mode: Send message with emoji reaction options
 * Admin reacts with ✅ to approve or ❌ to reject
 */
async function handleWhatsAppNannyMode(
  env: Env,
  config: ApprovalWorkflowConfig,
  risk: any
) {
  try {
    const whatsappPhoneId = env.WHATSAPP_PHONE_ID;
    const whatsappAccessToken = env.WHATSAPP_ACCESS_TOKEN;

    if (!whatsappPhoneId || !whatsappAccessToken) {
      console.warn('WhatsApp credentials not configured, falling back to manual approval');
      return handleManualUIApproval(env, config, risk);
    }

    // Build nanny mode message
    const message = buildNannyModeWhatsAppMessage(
      config.commandId,
      {
        action: config.action,
        actor: config.actor,
        integrationId: config.integrationId,
        provider: config.provider,
      },
      risk
    );

    // Send to WhatsApp (simplified — actual implementation depends on WhatsApp Business API)
    const response = await fetch(`https://graph.instagram.com/v18.0/${whatsappPhoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: env.ADMIN_WHATSAPP_NUMBER || '1234567890', // Replace with actual admin number
        type: 'text',
        text: { body: message },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to send WhatsApp message:', error);
      return handleManualUIApproval(env, config, risk);
    }

    const data = await response.json<any>();
    const messageId = data.messages?.[0]?.id;

    // Store WhatsApp message ID for reaction polling
    const commandKey = `cmd:${config.commandId}`;
    const command = await getCommandStatus(env, config.commandId);
    if (command) {
      const updatedCommand = {
        ...command,
        whatsapp_message_id: messageId,
        reaction_timeout_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      };
      await env.KV.put(commandKey, JSON.stringify(updatedCommand), { expirationTtl: 86400 });
    }

    await logAdminAction(env, {
      action: 'approval.whatsapp_sent',
      actor: 'system',
      status: 'success',
      metadata: {
        command_id: config.commandId,
        message_id: messageId,
        risk_level: risk.riskLevel,
      },
    });

    return {
      status: 'pending_whatsapp_reaction',
      messageId,
      riskLevel: risk.riskLevel,
      confidenceScore: risk.confidenceScore,
    };
  } catch (error) {
    console.error('WhatsApp nanny mode error:', error);
    return handleManualUIApproval(env, config, risk);
  }
}

/**
 * Manual UI approval: Wait for admin to approve via dashboard
 */
async function handleManualUIApproval(env: Env, config: ApprovalWorkflowConfig, risk: any) {
  await logAdminAction(env, {
    action: 'approval.manual_pending',
    actor: 'system',
    status: 'success',
    metadata: {
      command_id: config.commandId,
      risk_level: risk.riskLevel,
      confidence_score: risk.confidenceScore,
      recommendations: risk.recommendations,
    },
  });

  return {
    status: 'pending_manual_approval',
    riskLevel: risk.riskLevel,
    confidenceScore: risk.confidenceScore,
    safeToAutoApprove: risk.safeToAutoApprove,
  };
}

/**
 * Auto approval: Execute immediately if low-risk and safe
 */
async function handleAutoApproval(env: Env, config: ApprovalWorkflowConfig, risk: any) {
  if (risk.riskLevel !== 'low' || !risk.safeToAutoApprove) {
    console.warn('Auto-approval not safe, falling back to manual approval', {
      riskLevel: risk.riskLevel,
      safeToAutoApprove: risk.safeToAutoApprove,
    });
    return handleManualUIApproval(env, config, risk);
  }

  try {
    // Approve immediately
    await approveCommand(env, config.commandId, 'auto_approval');

    await logAdminAction(env, {
      action: 'approval.auto_approved',
      actor: 'goldclaw',
      status: 'success',
      metadata: {
        command_id: config.commandId,
        risk_level: risk.riskLevel,
        confidence_score: risk.confidenceScore,
      },
    });

    return {
      status: 'auto_approved',
      riskLevel: risk.riskLevel,
      confidenceScore: risk.confidenceScore,
      message: 'Automatically approved due to low risk profile',
    };
  } catch (error) {
    console.error('Auto-approval execution failed:', error);
    return handleManualUIApproval(env, config, risk);
  }
}

/**
 * Poll WhatsApp reactions and execute on emoji approval/rejection
 * Called periodically (e.g., every 5-10 seconds) until timeout
 */
export async function pollWhatsAppReaction(
  env: Env,
  commandId: string,
  messageId: string
): Promise<{ approved: boolean; emoji?: string } | null> {
  try {
    const whatsappAccessToken = env.WHATSAPP_ACCESS_TOKEN;

    if (!whatsappAccessToken) {
      return null;
    }

    // Fetch message reactions from WhatsApp
    const response = await fetch(`https://graph.instagram.com/v18.0/${messageId}?fields=reactions`, {
      headers: {
        'Authorization': `Bearer ${whatsappAccessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json<any>();
    const reactions = data.reactions || [];

    // Check for approval/rejection emojis
    const approvalEmoji = reactions.find((r: any) => r.emoji === '✅');
    const rejectionEmoji = reactions.find((r: any) => r.emoji === '❌');

    if (approvalEmoji) {
      return { approved: true, emoji: '✅' };
    }

    if (rejectionEmoji) {
      return { approved: false, emoji: '❌' };
    }

    return null;
  } catch (error) {
    console.error('Failed to poll WhatsApp reactions:', error);
    return null;
  }
}

/**
 * Execute approved command
 */
export async function executeApprovedCommand(
  env: Env,
  commandId: string,
  action: string,
  params: Record<string, unknown>
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    // Route to appropriate handler based on action
    switch (action) {
      case 'rotate_token':
        return await handleTokenRotation(env, params);

      case 'update_budget':
        return await handleBudgetUpdate(env, params);

      case 'pause_campaign':
        return await handlePauseCampaign(env, params);

      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Handler stubs for different command types
 */
async function handleTokenRotation(env: Env, params: Record<string, unknown>) {
  // Implement token rotation logic
  return { success: true, result: { rotatedAt: new Date().toISOString() } };
}

async function handleBudgetUpdate(env: Env, params: Record<string, unknown>) {
  // Implement budget update logic
  return { success: true, result: { updatedAt: new Date().toISOString() } };
}

async function handlePauseCampaign(env: Env, params: Record<string, unknown>) {
  // Implement campaign pause logic
  return { success: true, result: { pausedAt: new Date().toISOString() } };
}
