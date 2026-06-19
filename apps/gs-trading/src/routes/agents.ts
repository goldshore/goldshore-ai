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

// GET /api/agents/recommendations
agentRoutes.get('/recommendations', async (c) => {
  if (!c.env.PAPER_DB) return c.json({ error: 'PAPER_DB not configured' }, 503);
  const result = await c.env.PAPER_DB.prepare(
    "SELECT * FROM agent_recommendations WHERE status = 'pending' ORDER BY created_at DESC"
  ).all();
  return c.json({ mode: 'AGENTIC ACCOUNT', recommendations: result.results ?? [] });
});

// POST /api/agents/recommendations/:id/approve
agentRoutes.post('/recommendations/:id/approve', async (c) => {
  if (!c.env.PAPER_DB) return c.json({ error: 'PAPER_DB not configured' }, 503);
  const id = c.req.param('id');
  const db = c.env.PAPER_DB;
  const rec = await db.prepare('SELECT * FROM agent_recommendations WHERE id = ?').bind(id).first<any>();
  if (!rec) return c.json({ error: 'Recommendation not found' }, 404);
  if (rec.status !== 'pending') return c.json({ error: `Cannot approve recommendation with status: ${rec.status}` }, 400);
  if (rec.expires_at < Date.now()) {
    await db.prepare("UPDATE agent_recommendations SET status = 'expired' WHERE id = ?").bind(id).run();
    return c.json({ error: 'Recommendation has expired' }, 400);
  }

  const now = Date.now();
  const orderId = crypto.randomUUID();
  await db.batch([
    db.prepare("UPDATE agent_recommendations SET status = 'approved' WHERE id = ?").bind(id),
    db.prepare('INSERT INTO paper_orders (id, symbol, side, quantity, order_type, limit_price, status, fill_price, fill_quantity, source, agent_recommendation_id, approved_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(orderId, rec.symbol, rec.action === 'buy' ? 'buy' : 'sell', rec.quantity ?? 1, 'market', null, 'pending', null, 0, 'agent', id, 'human', now, now),
  ]);

  return c.json({ mode: 'AGENTIC ACCOUNT', approved: true, orderId, recommendation: rec });
});

// POST /api/agents/recommendations/:id/reject
agentRoutes.post('/recommendations/:id/reject', async (c) => {
  if (!c.env.PAPER_DB) return c.json({ error: 'PAPER_DB not configured' }, 503);
  const id = c.req.param('id');
  const db = c.env.PAPER_DB;
  const rec = await db.prepare('SELECT * FROM agent_recommendations WHERE id = ?').bind(id).first<any>();
  if (!rec) return c.json({ error: 'Recommendation not found' }, 404);
  if (rec.status !== 'pending') return c.json({ error: `Cannot reject recommendation with status: ${rec.status}` }, 400);
  await db.prepare("UPDATE agent_recommendations SET status = 'rejected' WHERE id = ?").bind(id).run();
  return c.json({ mode: 'AGENTIC ACCOUNT', rejected: true, id });
});
