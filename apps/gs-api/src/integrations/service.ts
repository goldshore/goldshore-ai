import { CONNECTOR_DEFINITIONS } from './catalog';
import { createConnector } from './connector';
import type { ConnectorAudience, ConnectorContext, ConnectorId, InvocationRequest } from './types';

const isConnectorId = (value: string): value is ConnectorId => value in CONNECTOR_DEFINITIONS;
export const listCapabilities = async (context: ConnectorContext, audience: ConnectorAudience) => Promise.all(Object.keys(CONNECTOR_DEFINITIONS).map(async (id) => ({ id, capabilities: await createConnector(id as ConnectorId, context).discoverCapabilities(audience) })));

export async function invokeConnector(context: ConnectorContext, id: string, request: InvocationRequest) {
  if (!isConnectorId(id)) throw new Error('Unknown connector');
  const replayKey = `connector:replay:${id}:${request.idempotencyKey}`;
  const replay = await context.env.KV.get(replayKey, 'json') as { result?: unknown } | null;
  if (replay?.result) return replay.result;
  const lock = JSON.stringify({ actor: request.actor, createdAt: new Date().toISOString() });
  await context.env.KV.put(replayKey, lock, { expirationTtl: 86400 });
  try { const result = await createConnector(id, context).retry(request); await context.env.KV.put(replayKey, JSON.stringify({ result }), { expirationTtl: 86400 }); return result; }
  catch (error) { await context.env.KV.delete(replayKey); throw error; }
}

export async function emergencyRevoke(context: ConnectorContext, id: string, actor: string, reason: string) {
  if (!isConnectorId(id)) throw new Error('Unknown connector');
  await createConnector(id, context).revoke(actor, reason);
}
