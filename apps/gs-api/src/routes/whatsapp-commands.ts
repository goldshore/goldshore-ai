/**
 * WhatsApp Command Handler
 * Processes commands via WhatsApp Business API
 * Supports two approval workflows: manual dashboard approval and WhatsApp reaction-based approval
 */

import { Hono } from 'hono';
import { getActor, logAdminAction, requirePermission } from '../auth';
import type { Env, Variables } from '../types';
import {
  queueCommand,
  getCommandStatus,
  approveCommand,
  rejectCommand,
  approveCommandViaReaction,
  listPendingCommands,
  markCommandExecuted,
  markCommandFailed,
} from '../lib/command-queue';
import { rotateSecret, findExpiringSecrets } from '../lib/secrets';
import {
  processCommandWithRiskAssessment,
  executeApprovedCommand,
  pollWhatsAppReaction,
} from '../lib/approval-workflow';
import type { CommandContext } from '../lib/risk-assessment';

const whatsappCommands = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * Build CommandContext for risk assessment from parsed command data
 */
async function buildCommandContext(
  env: Env,
  action: string,
  params: Record<string, unknown>,
  integrationId: string,
  provider: string
): Promise<CommandContext> {
  return {
    action,
    actor: 'whatsapp_admin',
    integrationId,
    provider,
    recentErrorCount: 0,
    uptime: 99.5,
    lastSyncHours: 2,
    monthlySpend: 500,
    isProductionAccount: true,
    tokenRotationCount: 3,
    tokenAgeHours: 240,
  };
}

/**
 * Parse WhatsApp command text
 * Supported formats:
 * - "setup-stripe: sk_live_xyz" - Store Stripe API key
 * - "rotate-meta" - Rotate Meta API token
 * - "status-all" - Get status of all integrations
 * - "list-expired" - List expired keys
 * - "test-stripe" - Test Stripe key validity
 */
function parseCommand(
  text: string
): {
  action: string;
  params: Record<string, unknown>;
  success: boolean;
  error?: string;
} {
  const trimmed = text.trim();

  // Parse "setup-<provider>: <key>" format
  const setupMatch = trimmed.match(/^setup-(\w+):\s*(.+)$/i);
  if (setupMatch) {
    return {
      action: 'setup_integration',
      params: {
        provider: setupMatch[1].toLowerCase(),
        api_key: setupMatch[2].trim(),
      },
      success: true,
    };
  }

  // Parse "rotate-<provider>" format
  const rotateMatch = trimmed.match(/^rotate-(\w+)$/i);
  if (rotateMatch) {
    return {
      action: 'rotate_integration_key',
      params: {
        provider: rotateMatch[1].toLowerCase(),
      },
      success: true,
    };
  }

  // Parse "test-<provider>" format
  const testMatch = trimmed.match(/^test-(\w+)$/i);
  if (testMatch) {
    return {
      action: 'test_integration',
      params: {
        provider: testMatch[1].toLowerCase(),
      },
      success: true,
    };
  }

  // Built-in commands
  if (trimmed.toLowerCase() === 'status-all') {
    return {
      action: 'list_integration_status',
      params: {},
      success: true,
    };
  }

  if (trimmed.toLowerCase() === 'list-expired') {
    return {
      action: 'list_expired_keys',
      params: {},
      success: true,
    };
  }

  return {
    action: '',
    params: {},
    success: false,
    error: 'Unknown command format. Supported: setup-<provider>: <key>, rotate-<provider>, test-<provider>, status-all, list-expired',
  };
}

/**
 * POST /whatsapp/commands
 * Receive and queue WhatsApp command with risk assessment
 * Body: { text: "setup-stripe: sk_live_...", approval_method: "manual_ui"|"whatsapp_reaction"|"auto" }
 * Requires: system:integrations:manage permission
 */
whatsappCommands.post(
  '/',
  requirePermission('system:integrations:manage'),
  async (c) => {
    try {
      const body = await c.req.json<{
        text: string;
        approval_method?: 'manual_ui' | 'whatsapp_reaction' | 'auto';
      }>();

      if (!body.text) {
        return c.json({ error: 'Missing command text' }, 400);
      }

      const parsed = parseCommand(body.text);
      if (!parsed.success) {
        return c.json({ error: parsed.error }, 400);
      }

      const actor = getActor(c.get('accessClaims'), c.req.raw);
      const approvalMethod = body.approval_method || 'manual_ui';
      const provider = (parsed.params.provider || 'unknown') as string;

      // Queue the command
      const commandId = await queueCommand(
        c.env,
        actor,
        parsed.action,
        parsed.params,
        approvalMethod
      );

      // Build context and process with risk assessment
      const context = await buildCommandContext(
        c.env,
        parsed.action,
        parsed.params,
        `integration_${provider}`,
        provider
      );

      const workflowResult = await processCommandWithRiskAssessment(c.env, {
        commandId,
        actor,
        action: parsed.action,
        integrationId: `integration_${provider}`,
        provider,
        approvalMethod,
      }, context);

      // Log the command queueing
      await logAdminAction(c.env, {
        action: 'command.queue',
        actor,
        status: 'success',
        metadata: {
          command_id: commandId,
          command_action: parsed.action,
          approval_method: approvalMethod,
          risk_level: (workflowResult as any).riskLevel,
          confidence_score: (workflowResult as any).confidenceScore,
        },
      });

      return c.json({
        success: true,
        data: {
          command_id: commandId,
          ...workflowResult,
          created_at: new Date().toISOString(),
        },
      }, 202);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Command queueing error:', error);

      await logAdminAction(c.env, {
        action: 'command.queue',
        actor: getActor(c.get('accessClaims'), c.req.raw),
        status: 'error',
        metadata: { error: errorMsg },
      });

      return c.json({ error: errorMsg }, 500);
    }
  }
);

/**
 * GET /whatsapp/commands/queue/:commandId
 * Poll command status
 * Requires: system:integrations:manage permission
 */
whatsappCommands.get(
  '/queue/:commandId',
  requirePermission('system:integrations:manage'),
  async (c) => {
    try {
      const commandId = c.req.param('commandId');

      if (!commandId) {
        return c.json({ error: 'Missing command ID' }, 400);
      }

      const command = await getCommandStatus(c.env, commandId);

      if (!command) {
        return c.json({ error: 'Command not found' }, 404);
      }

      return c.json({ success: true, data: command });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Command status error:', error);
      return c.json({ error: errorMsg }, 500);
    }
  }
);

/**
 * GET /whatsapp/commands/pending
 * List all pending commands for current actor
 * Requires: system:integrations:manage permission
 */
whatsappCommands.get(
  '/pending',
  requirePermission('system:integrations:manage'),
  async (c) => {
    try {
      const actor = getActor(c.get('accessClaims'), c.req.raw);
      const commands = await listPendingCommands(c.env, actor);

      return c.json({
        success: true,
        data: {
          count: commands.length,
          commands,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('List pending commands error:', error);
      return c.json({ error: errorMsg }, 500);
    }
  }
);

/**
 * POST /whatsapp/commands/queue/:commandId/approve
 * Manually approve and execute a queued command from admin UI
 * Requires: system:integrations:manage permission
 */
whatsappCommands.post(
  '/queue/:commandId/approve',
  requirePermission('system:integrations:manage'),
  async (c) => {
    try {
      const commandId = c.req.param('commandId');

      if (!commandId) {
        return c.json({ error: 'Missing command ID' }, 400);
      }

      const command = await approveCommand(c.env, commandId);
      const actor = getActor(c.get('accessClaims'), c.req.raw);

      // Execute the approved command
      const executionResult = await executeApprovedCommand(
        c.env,
        commandId,
        command.action,
        command.params
      );

      // Mark as executed if successful
      if (executionResult.success) {
        await markCommandExecuted(c.env, commandId, executionResult.result);
      } else {
        await markCommandFailed(c.env, commandId, executionResult.error);
      }

      // Log approval and execution
      await logAdminAction(c.env, {
        action: 'command.approve',
        actor,
        status: executionResult.success ? 'success' : 'error',
        metadata: {
          command_id: commandId,
          command_action: command.action,
          execution_result: executionResult.result,
          execution_error: executionResult.error,
        },
      });

      return c.json({
        success: true,
        data: {
          command,
          execution: executionResult,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Command approval error:', error);

      await logAdminAction(c.env, {
        action: 'command.approve',
        actor: getActor(c.get('accessClaims'), c.req.raw),
        status: 'error',
        metadata: { error: errorMsg },
      });

      return c.json({ error: errorMsg }, 500);
    }
  }
);

/**
 * POST /whatsapp/commands/queue/:commandId/reject
 * Reject a queued command
 * Body: { reason?: "User rejected" }
 * Requires: system:integrations:manage permission
 */
whatsappCommands.post(
  '/queue/:commandId/reject',
  requirePermission('system:integrations:manage'),
  async (c) => {
    try {
      const commandId = c.req.param('commandId');
      const body = await c.req.json<{ reason?: string }>();

      if (!commandId) {
        return c.json({ error: 'Missing command ID' }, 400);
      }

      const command = await rejectCommand(c.env, commandId, body.reason);
      const actor = getActor(c.get('accessClaims'), c.req.raw);

      // Log rejection
      await logAdminAction(c.env, {
        action: 'command.reject',
        actor,
        status: 'success',
        metadata: {
          command_id: commandId,
          command_action: command.action,
          reason: body.reason,
        },
      });

      return c.json({ success: true, data: command });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Command rejection error:', error);

      await logAdminAction(c.env, {
        action: 'command.reject',
        actor: getActor(c.get('accessClaims'), c.req.raw),
        status: 'error',
        metadata: { error: errorMsg },
      });

      return c.json({ error: errorMsg }, 500);
    }
  }
);

/**
 * POST /whatsapp/commands/webhook/reaction
 * Handle WhatsApp message reactions for approval and execution
 * Called by WhatsApp Business API webhook when user reacts to approval message
 * Body: { message_id: "...", reaction_emoji: "✅"|"❌", command_id: "..." }
 * No permission required (webhook verification handled separately)
 */
whatsappCommands.post('/webhook/reaction', async (c) => {
  try {
    const body = await c.req.json<{
      message_id: string;
      reaction_emoji: string;
      command_id: string;
    }>();

    if (!body.message_id || !body.reaction_emoji || !body.command_id) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Handle rejection
    if (body.reaction_emoji === '❌') {
      await rejectCommand(c.env, body.command_id, 'User rejected via WhatsApp reaction');
      await logAdminAction(c.env, {
        action: 'command.reject',
        actor: 'whatsapp_webhook',
        status: 'success',
        metadata: {
          command_id: body.command_id,
          rejection_method: 'whatsapp_reaction',
          emoji: '❌',
        },
      });
      return c.json({
        success: true,
        message: 'Command rejected',
        data: { command_id: body.command_id, status: 'rejected' },
      });
    }

    // Only approve on checkmark, thumbs up, or clapping emojis
    if (!['✅', '👍', '👏'].includes(body.reaction_emoji)) {
      return c.json({ success: true, message: 'Reaction noted but not actionable' });
    }

    const command = await approveCommandViaReaction(
      c.env,
      body.command_id,
      body.reaction_emoji
    );

    // Execute the approved command
    const executionResult = await executeApprovedCommand(
      c.env,
      body.command_id,
      command.action,
      command.params
    );

    // Mark as executed or failed
    if (executionResult.success) {
      await markCommandExecuted(c.env, body.command_id, executionResult.result);
    } else {
      await markCommandFailed(c.env, body.command_id, executionResult.error);
    }

    // Log execution
    await logAdminAction(c.env, {
      action: 'command.approve',
      actor: 'whatsapp_webhook',
      status: executionResult.success ? 'success' : 'error',
      metadata: {
        command_id: body.command_id,
        approval_method: 'whatsapp_reaction',
        emoji: body.reaction_emoji,
        execution_result: executionResult.result,
        execution_error: executionResult.error,
      },
    });

    console.log(
      `Command ${body.command_id} approved and executed via WhatsApp reaction (${body.reaction_emoji})`
    );

    return c.json({
      success: true,
      data: {
        command_id: body.command_id,
        status: executionResult.success ? 'executed' : 'execution_failed',
        execution: executionResult,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Reaction webhook error:', error);
    return c.json({ error: errorMsg }, 500);
  }
});

export default whatsappCommands;
