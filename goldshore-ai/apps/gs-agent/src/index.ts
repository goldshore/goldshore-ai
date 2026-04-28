// GoldShore Agent Worker
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { verifyAccess } from '@goldshore/auth';

interface Env {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	AI: any;
	CLOUDFLARE_ACCESS_AUDIENCE?: string;
	CLOUDFLARE_TEAM_DOMAIN?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Sentinel: Add security headers to all responses (Defense in Depth)
app.use('*', secureHeaders());

// Sentinel: Add CORS protection
app.use(
	'*',
	cors({
		origin: '*', // Adjust if stricter policy is needed
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Authorization', 'CF-Access-Jwt-Assertion'],
		exposeHeaders: ['Content-Length'],
		maxAge: 600,
	}),
);

// Sentinel: CRITICAL - Enforce Authentication on all sensitive endpoints
app.use('*', async (c, next) => {
	// Allow root (status check) and health check to remain public
	if (c.req.path === '/' || c.req.path === '/health') {
		await next();
		return;
	}

	const authorized = await verifyAccess(c.req.raw, c.env);
	if (!authorized) {
		return c.json({ error: 'Unauthorized' }, 401);
	}
	await next();
});

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
        p { color: #94a3b8; }
        .status { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; background: #db2777; color: #fff; font-size: 0.875rem; font-weight: 600; margin-top: 1rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>GoldShore Agent</h1>
        <p>AI Autonomous Service</p>
        <div class="status">STANDBY</div>
        <p><small>Service: gs-agent</small></p>
      </div>
    </body>
    </html>
  `);
});

app.get('/health', (c) => c.json({ status: 'ok', service: 'gs-agent' }));

export default {
	fetch: app.fetch,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async queue(batch: any, env: Env): Promise<void> {
		console.log(`Received batch of ${batch.messages.length} messages`);
	},
};
