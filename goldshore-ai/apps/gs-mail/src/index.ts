import { Hono } from 'hono';

interface Env {
  ENV?: string;
  MAIL_FORWARD_TO?: string;
  MAIL_ALLOWED_RECIPIENTS?: string;
  MAIL_BLOCKED_SENDERS?: string;
}

const VERSION = '2026.02.10-mail-worker-fix';

const app = new Hono<{ Bindings: Env }>();

const isEmailLike = (value: string) => /.+@.+\..+/.test(value);

app.get('/', (c) => c.text('GoldShore Mail Worker'));

app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'gs-mail', env: c.env.ENV ?? 'unknown' }),
);

app.get('/system/info', (c) =>
  c.json({
    service: 'gs-mail',
    runtime: 'cloudflare-worker',
    env: c.env.ENV ?? 'unknown',
  }),
);

app.get('/version', (c) => c.json({ version: VERSION }));

app.post('/webhook', async (c) => {
  // Reserved for future provider hooks.
  return c.json({ received: true });
});

export default {
  fetch: app.fetch,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async email(message: EmailMessage, _env: Env, _ctx: ExecutionContext): Promise<void> {
    // Basic email handler scaffolding
    console.log(`Received email from ${message.from} to ${message.to}`);

    const forwardTo = _env.MAIL_FORWARD_TO?.trim();
    if (!forwardTo || !isEmailLike(forwardTo)) {
      message.setReject('Mail forwarding is not configured.');
      return;
    }

    await message.forward(forwardTo);
  },
};
