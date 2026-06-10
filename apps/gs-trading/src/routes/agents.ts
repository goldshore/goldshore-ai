import { Hono } from 'hono';
import { AgentOrchestrator } from '../agents/orchestrator';
import type { TradingEnv } from '../types';
import type { AgentCommand } from '../agents/types';

export const agentRoutes = new Hono<{ Bindings: TradingEnv }>();

agentRoutes.get('/', async (c) => {
  const orch = new AgentOrchestrator(c.env.TRADING_KV);
  const agents = await orch.getAgents();
  return c.json({ agents });
});

agentRoutes.get('/:id', async (c) => {
  const orch = new AgentOrchestrator(c.env.TRADING_KV);
  const agent = await orch.getAgent(c.req.param('id'));
  if (!agent) return c.json({ error: 'Agent not found' }, 404);
  return c.json({ agent });
});

agentRoutes.post('/:id/command', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const cmd: AgentCommand = { agentId: c.req.param('id'), action: body.action, config: body.config };
  const valid = ['START', 'STOP', 'PAUSE', 'RESUME', 'CONFIG'];
  if (!valid.includes(cmd.action)) return c.json({ error: 'Invalid action' }, 400);
  const orch = new AgentOrchestrator(c.env.TRADING_KV);
  const agent = await orch.executeCommand(cmd);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);
  return c.json({ agent });
});

agentRoutes.get('/signals/all', async (c) => {
  const orch = new AgentOrchestrator(c.env.TRADING_KV);
  let signals = await orch.getSignals();
  if (signals.length === 0) signals = await orch.generateDemoSignals();
  return c.json({ signals });
});

agentRoutes.post('/signals/generate', async (c) => {
  const orch = new AgentOrchestrator(c.env.TRADING_KV);
  const signals = await orch.generateDemoSignals();
  return c.json({ signals, count: signals.length });
});
