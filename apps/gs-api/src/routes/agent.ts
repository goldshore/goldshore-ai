import { Hono } from 'hono';

const agent = new Hono();

agent.get('/', (c) => c.html(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>GoldShore Agent</title></head><body><h1>GoldShore Agent</h1><p>Autonomous Background Processor</p><strong>ACTIVE & LISTENING</strong><p><small>Service: gs-api/agent</small></p></body></html>`));
agent.get('/health', (c) => c.json({ status: 'ok', service: 'gs-api-agent' }));
agent.get('/status', (c) => c.json({ status: 'ok', service: 'gs-api-agent', note: 'Legacy gs-agent behavior is consolidated into gs-api.' }));
agent.get('/templates', (c) => c.json({ service: 'gs-api-agent', modules: [
  { name: 'operator-assist', purpose: 'Human-in-the-loop review queues.' },
  { name: 'ai-routing', purpose: 'Gemini/GPT orchestration.' },
  { name: 'market-intel', purpose: 'Brokerage and signal fusion.' },
] }));

export default agent;
