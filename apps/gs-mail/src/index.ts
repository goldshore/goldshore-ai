import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.json({ service: 'gs-mail', status: 'operational' }));
app.get('/health', (c) => c.json({ status: 'ok', service: 'gs-mail' }));

export default {
  async fetch(request: Request, env: any, ctx: any) {
    return app.fetch(request, env, ctx);
  },

  async email(message: any, env: any, ctx: any) {
    const { from, to, headers } = message;
    const subject = headers.get('subject');

    console.log(`[gs-mail] Processing email from ${from} to ${to} with subject: ${subject}`);

    // Logic to store in D1 or KV, or trigger a queue task
    if (env.JOBS_QUEUE) {
      await env.JOBS_QUEUE.send({
        type: 'email_received',
        payload: {
          from,
          to,
          subject,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Forwarding or processing logic can be added here
  }
};
