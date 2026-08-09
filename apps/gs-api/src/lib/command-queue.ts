/**
 * Command Queue System
 * Manages pending commands awaiting approval (manual UI or WhatsApp reactions)
 * Supports two approval workflows: manual dashboard approval and WhatsApp reaction-based approval
 */

import type { Env } from '../types';

export type ApprovalMethod = 'manual_ui' | 'whatsapp_reaction';
export type CommandStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | 'timeout';

export interface QueuedCommand {
  id: string;
  actor: string;
  action: string;
  params: Record<string, unknown>;
  status: CommandStatus;
  approval_method?: ApprovalMethod;
  created_at: string;
  executed_at?: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  error?: string;
  whatsapp_message_id?: string;
  whatsapp_reaction_emoji?: string;
  reaction_timeout_at?: string;
}

/**
 * Queue a command for approval
 * Returns the queue ID for polling status
 */
export async function queueCommand(
  env: Env,
  actor: string,
  action: string,
  params: Record<string, unknown>,
  approvalMethod: ApprovalMethod = 'manual_ui'
): Promise<string> {
  const commandId = `cmd_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const command: QueuedCommand = {
    id: commandId,
    actor,
    action,
    params,
    status: 'pending',
    approval_method: approvalMethod,
    created_at: now,
    reaction_timeout_at: approvalMethod === 'whatsapp_reaction'
      ? new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10-minute timeout
      : undefined,
  };

  try {
    // Store in KV with 24-hour TTL (86400 seconds)
    await env.KV.put(
      `cmd:${commandId}`,
      JSON.stringify(command),
      { expirationTtl: 86400 }
    );

    // Also add to pending index for quick lookup
    await env.KV.put(
      `cmd:pending:${commandId}`,
      commandId,
      { expirationTtl: 86400 }
    );

    return commandId;
  } catch (error) {
    console.error('Failed to queue command:', error);
    throw new Error('Failed to queue command');
  }
}

/**
 * Get command status from queue
 */
export async function getCommandStatus(
  env: Env,
  commandId: string
): Promise<QueuedCommand | null> {
  try {
    const data = await env.KV.get(`cmd:${commandId}`);
    if (!data) {
      return null;
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to get command status:', error);
    return null;
  }
}

/**
 * List all pending commands for a given actor
 */
export async function listPendingCommands(
  env: Env,
  actor?: string
): Promise<QueuedCommand[]> {
  try {
    // This is a simplified implementation
    // In production, you'd want a proper indexing strategy
    // For now, we'll rely on polling individual command status

    const commands: QueuedCommand[] = [];
    const keyList = await env.KV.list({ prefix: 'cmd:pending:' });

    for (const key of keyList.keys) {
      const commandId = await env.KV.get(key.name);
      if (commandId) {
        const cmd = await getCommandStatus(env, commandId);
        if (cmd && (!actor || cmd.actor === actor)) {
          commands.push(cmd);
        }
      }
    }

    return commands;
  } catch (error) {
    console.error('Failed to list pending commands:', error);
    return [];
  }
}

/**
 * Approve a command via manual UI
 */
export async function approveCommand(
  env: Env,
  commandId: string
): Promise<QueuedCommand> {
  try {
    const command = await getCommandStatus(env, commandId);
    if (!command) {
      throw new Error('Command not found');
    }

    if (command.status !== 'pending') {
      throw new Error(`Cannot approve command with status: ${command.status}`);
    }

    command.status = 'approved';
    command.approved_at = new Date().toISOString();
    command.approval_method = 'manual_ui';

    await env.KV.put(
      `cmd:${commandId}`,
      JSON.stringify(command),
      { expirationTtl: 86400 }
    );

    // Remove from pending index
    await env.KV.delete(`cmd:pending:${commandId}`);

    return command;
  } catch (error) {
    console.error('Failed to approve command:', error);
    throw new Error('Failed to approve command');
  }
}

/**
 * Reject a command
 */
export async function rejectCommand(
  env: Env,
  commandId: string,
  reason: string = 'Rejected by user'
): Promise<QueuedCommand> {
  try {
    const command = await getCommandStatus(env, commandId);
    if (!command) {
      throw new Error('Command not found');
    }

    if (command.status !== 'pending') {
      throw new Error(`Cannot reject command with status: ${command.status}`);
    }

    command.status = 'rejected';
    command.rejected_at = new Date().toISOString();
    command.rejection_reason = reason;

    await env.KV.put(
      `cmd:${commandId}`,
      JSON.stringify(command),
      { expirationTtl: 86400 }
    );

    // Remove from pending index
    await env.KV.delete(`cmd:pending:${commandId}`);

    return command;
  } catch (error) {
    console.error('Failed to reject command:', error);
    throw new Error('Failed to reject command');
  }
}

/**
 * Mark command as executed
 */
export async function markCommandExecuted(
  env: Env,
  commandId: string
): Promise<QueuedCommand> {
  try {
    const command = await getCommandStatus(env, commandId);
    if (!command) {
      throw new Error('Command not found');
    }

    command.status = 'executed';
    command.executed_at = new Date().toISOString();

    await env.KV.put(
      `cmd:${commandId}`,
      JSON.stringify(command),
      { expirationTtl: 86400 }
    );

    return command;
  } catch (error) {
    console.error('Failed to mark command executed:', error);
    throw new Error('Failed to mark command executed');
  }
}

/**
 * Mark command as failed
 */
export async function markCommandFailed(
  env: Env,
  commandId: string,
  error: string
): Promise<QueuedCommand> {
  try {
    const command = await getCommandStatus(env, commandId);
    if (!command) {
      throw new Error('Command not found');
    }

    command.status = 'failed';
    command.executed_at = new Date().toISOString();
    command.error = error;

    await env.KV.put(
      `cmd:${commandId}`,
      JSON.stringify(command),
      { expirationTtl: 86400 }
    );

    return command;
  } catch (error) {
    console.error('Failed to mark command as failed:', error);
    throw new Error('Failed to mark command as failed');
  }
}

/**
 * Handle WhatsApp reaction approval
 * Called when user reacts to the approval message
 */
export async function approveCommandViaReaction(
  env: Env,
  commandId: string,
  emoji: string
): Promise<QueuedCommand> {
  try {
    const command = await getCommandStatus(env, commandId);
    if (!command) {
      throw new Error('Command not found');
    }

    if (command.status !== 'pending') {
      throw new Error(`Cannot approve command with status: ${command.status}`);
    }

    if (command.approval_method !== 'whatsapp_reaction') {
      throw new Error('Command does not require WhatsApp reaction approval');
    }

    // Check if reaction timeout has passed
    if (command.reaction_timeout_at) {
      const timeoutDate = new Date(command.reaction_timeout_at);
      const now = new Date();
      if (now > timeoutDate) {
        command.status = 'timeout';
        await env.KV.put(`cmd:${commandId}`, JSON.stringify(command), { expirationTtl: 86400 });
        throw new Error('Command approval window has expired');
      }
    }

    command.status = 'approved';
    command.approved_at = new Date().toISOString();
    command.whatsapp_reaction_emoji = emoji;

    await env.KV.put(
      `cmd:${commandId}`,
      JSON.stringify(command),
      { expirationTtl: 86400 }
    );

    // Remove from pending index
    await env.KV.delete(`cmd:pending:${commandId}`);

    return command;
  } catch (error) {
    console.error('Failed to approve command via reaction:', error);
    throw new Error('Failed to approve command via reaction');
  }
}

/**
 * Store WhatsApp message ID for reaction monitoring
 */
export async function setWhatsAppMessageId(
  env: Env,
  commandId: string,
  messageId: string
): Promise<void> {
  try {
    const command = await getCommandStatus(env, commandId);
    if (!command) {
      throw new Error('Command not found');
    }

    command.whatsapp_message_id = messageId;

    await env.KV.put(
      `cmd:${commandId}`,
      JSON.stringify(command),
      { expirationTtl: 86400 }
    );
  } catch (error) {
    console.error('Failed to set WhatsApp message ID:', error);
    throw new Error('Failed to set WhatsApp message ID');
  }
}
