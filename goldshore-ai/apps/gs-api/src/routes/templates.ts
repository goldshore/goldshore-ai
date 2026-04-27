import { Hono } from 'hono';

const templates = new Hono();

templates.get('/', (c) =>
  c.json({
    service: 'gs-api',
    description: 'Template endpoints that document core API modules without replacing production logic.',
    modules: [
      {
        name: 'content',
        purpose: 'Serve marketing, docs, and operational content to the web and admin clients.'
      },
      {
        name: 'market-data',
        purpose: 'Integrate Alpaca, Thinkorswim, and other market-data providers via service adapters.'
      },
      {
        name: 'ai-agents',
        purpose: 'Route AI requests to Gemini, ChatGPT, Jules, and Cloudflare AI Gateway.'
      }
    ],
    nextSteps: [
      'Add request validation schemas per module.',
      'Attach queue-backed jobs for long-running tasks.',
      'Document auth scopes in /system endpoints.'
    ]
  })
);

export default templates;
