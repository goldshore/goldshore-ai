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

const whatsappCommands = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

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
 * Receive and queue WhatsApp command
 * Body: { text: "setup-stripe: sk_live_...", approval_method: "manual_ui"|"whatsapp_reaction" }
 * Requires: system:integrations:manage permission
 */
whatsappCommands.post(
  '/',
  requirePermission('system:integrations:manage'),
  async (c) => {
    try {
      const body = await c.req.json<{
        text: string;
        approval_method?: 'manual_ui' | 'whatsapp_reaction';
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

      // Queue the command
      const commandId = await queueCommand(
        c.env,
        actor,
        parsed.action,
        parsed.params,
        approvalMethod
      );

      // Log the command queueing
      await logAdminAction(c.env, {
        action: 'command.queue',
        actor,
        status: 'success',
        metadata: {
          command_id: commandId,
          command_action: parsed.action,
          approval_method: approvalMethod,
        },
      });

      return c.json({
        success: true,
        data: {
          command_id: commandId,
          status: 'pending',
          approval_method: approvalMethod,
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
 * Manually approve a queued command from admin UI
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

      // Log approval
      await logAdminAction(c.env, {
        action: 'command.approve',
        actor,
        status: 'success',
        metadata: {
          command_id: commandId,
          command_action: command.action,
        },
      });

      return c.json({ success: true, data: command });
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
 * Handle WhatsApp message reactions for approval
 * Called by WhatsApp Business API webhook when user reacts to approval message
 * Body: { message_id: "...", reaction_emoji: "✅" }
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

    // Only approve on checkmark emoji
    if (!['✅', '👍', '👏'].includes(body.reaction_emoji)) {
      return c.json({ success: true, message: 'Reaction noted but not actionable' });
    }

    const command = await approveCommandViaReaction(
      c.env,
      body.command_id,
      body.reaction_emoji
    );

    console.log(`Command ${body.command_id} approved via WhatsApp reaction`);

    return c.json({ success: true, data: command });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Reaction webhook error:', error);
    return c.json({ error: errorMsg }, 500);
  }
});

export default whatsappCommands;
