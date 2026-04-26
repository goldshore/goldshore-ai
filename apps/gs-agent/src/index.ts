import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { verifyAccess } from '@goldshore/auth';

interface Env {
	AI: any;
	ENV?: string;
	CLOUDFLARE_ACCESS_AUDIENCE?: string;
	CLOUDFLARE_TEAM_DOMAIN?: string;
	// Added binding for our shared JSON config
	AGENT_KV: KVNamespace; 
}

const app = new Hono<{ Bindings: Env }>();

// 1. Security & Middleware
app.use('*', secureHeaders());
app.use('*', cors({
	origin: '*', 
	allowMethods: ['GET', 'POST', 'OPTIONS'],
	allowHeaders: ['Content-Type', 'Authorization', 'CF-Access-Jwt-Assertion'],
}));

// 2. Auth Guard (Public vs Protected)
app.use('*', async (c, next) => {
	const publicPaths = ['/', '/health'];
	if (publicPaths.includes(c.req.path)) {
		await next();
		return;
	}

	if (c.env.ENV === 'production' && !c.env.CLOUDFLARE_ACCESS_AUDIENCE) {
		console.error('SECURITY ERROR: CLOUDFLARE_ACCESS_AUDIENCE must be configured for protected gs-agent routes in production.');
		return c.json({ error: 'Service auth misconfigured' }, 500);
	}

	const authorized = await verifyAccess(c.req.raw, c.env);
	if (!authorized) return c.json({ error: 'Unauthorized' }, 401);
	await next();
});

// 3. Status Page (Updated with Service Info)
app.get('/', (c) => {
	return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>GoldShore Agent</title>
      <style>
        body { font-family: system-ui, sans-serif; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .container { text-align: center; border: 1px solid #334155; padding: 2rem; border-radius: 8px; background: #1e293b; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        h1 { margin-bottom: 0.5rem; color: #f472b6; }
        .status { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; background: #059669; color: #fff; font-size: 0.875rem; font-weight: 600; margin-top: 1rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>GoldShore Agent</h1>
        <p>Autonomous Background Processor</p>
        <div class="status">ACTIVE & LISTENING</div>
        <p><small>Service: gs-agent-v2</small></p>
      </div>
    </body>
    </html>
  `);
});

app.get('/health', (c) => c.json({ status: 'ok', service: 'gs-agent' }));

// 4. Template Engine with KV integration
app.get('/templates', async (c) => {
	return c.json({
		service: 'gs-agent',
		modules: [
			{ name: 'operator-assist', purpose: 'Human-in-the-loop review queues.' },
			{ name: 'ai-routing', purpose: 'Gemini/GPT orchestration.' },
			{ name: 'market-intel', purpose: 'Alpaca & Signal fusion.' }
		]
	});
});

// 5. Background Queue Handler
export default {
	fetch: app.fetch,
	async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
		for (const message of batch.messages) {
			const jobType = typeof message.body === 'object' && message.body && 'type' in message.body
				? String((message.body as { type?: unknown }).type ?? 'unknown')
				: 'unknown';
			console.info({
				event: 'job_processed',
				id: message.id,
				jobType,
				timestamp: new Date().toISOString(),
			});
			message.ack(); // Complete the job
		}
	},
};
