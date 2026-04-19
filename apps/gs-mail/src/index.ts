import { Hono } from 'hono';
import {
  EmailInboxLogsSchema,
  EmailLogSchema,
  type EmailLog,
} from '@goldshore/schema';

interface Env {
  GS_CONFIG: KVNamespace;
  ENV?: string;
  MAIL_FORWARD_TO?: string;
  FORWARD_TO?: string;
  MAIL_BLOCKED_SENDERS?: string;
  MAIL_ALLOWED_RECIPIENTS?: string;
}

const VERSION = '2026.03.03-mail-inbox-log';
const app = new Hono<{ Bindings: Env }>();
const isEmailLike = (value: string) => {
  const normalized = normalizeEmail(value);
  const atIndex = normalized.indexOf('@');
  const lastDotIndex = normalized.lastIndexOf('.');

  return (
    atIndex > 0 &&
    lastDotIndex > atIndex + 1 &&
    lastDotIndex < normalized.length - 1
  );
};
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const parseEmailList = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizeEmail);

const readInboxLogs = async (kv: KVNamespace): Promise<EmailLog[]> => {
  const rawLogs = await kv.get('EMAIL_INBOX_LOGS', 'text');
  if (!rawLogs) {
    return [];
  }

  try {
    const parsedLogs = JSON.parse(rawLogs);
    const parseResult = EmailInboxLogsSchema.safeParse(parsedLogs);
    if (!parseResult.success) {
      console.error(
        '❌ Existing EMAIL_INBOX_LOGS payload failed schema validation:',
        parseResult.error,
      );
      return [];
    }

    return parseResult.data;
  } catch (error) {
    console.error('❌ Failed to parse EMAIL_INBOX_LOGS payload:', error);
    return [];
  }
};

app.get('/', (c) => c.text('GoldShore Mail Worker'));

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'gs-mail',
    env: c.env.ENV ?? 'production',
    version: VERSION,
  }),
);

app.get('/system/info', (c) =>
  c.json({
    service: 'gs-mail',
    runtime: 'cloudflare-worker',
    kv_bound: !!c.env.GS_CONFIG,
  }),
);

app.get('/version', (c) => c.json({ version: VERSION }));

app.post('/webhook', async (c) => {
  return c.json({ received: true });
});

app.post('/api/subscribe', async (c) => {
  return c.json({ status: 'subscribed' });
});

app.post('/api/contact', async (c) => {
  return c.json({ status: 'sent' });
});

export default {
  fetch: app.fetch,

  async email(
    message: ForwardableEmailMessage,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const sender = message.from;
    const recipient = message.to;
    const subject = (message.headers.get('subject') || 'No Subject').slice(
      0,
      50,
    );

    const normalizedSender = normalizeEmail(sender);
    const normalizedRecipient = normalizeEmail(recipient);
    const blocked = parseEmailList(env.MAIL_BLOCKED_SENDERS);
    if (blocked.includes(normalizedSender)) {
      message.setReject(`Sender ${sender} is blocked.`);
      return;
    }

    const allowed = parseEmailList(env.MAIL_ALLOWED_RECIPIENTS);
    if (allowed.length > 0 && !allowed.includes(normalizedRecipient)) {
      message.setReject(`Recipient ${recipient} is not allowlisted.`);
      return;
    }

    const parsedEntry = EmailLogSchema.safeParse({
      id: crypto.randomUUID(),
      from: sender,
      to: recipient,
      subject,
      timestamp: new Date().toISOString(),
    });

    if (!parsedEntry.success) {
      console.error(
        '🚨 Schema validation failed for inbound mail:',
        parsedEntry.error,
      );
      return;
    }

    ctx.waitUntil(
      (async () => {
        try {
          const existingLogs = await readInboxLogs(env.GS_CONFIG);
          const updatedLogs = [parsedEntry.data, ...existingLogs].slice(0, 100);

          await env.GS_CONFIG.put(
            'EMAIL_INBOX_LOGS',
            JSON.stringify(updatedLogs),
          );
          console.info(`✅ Logged email: ${sender} -> ${recipient}`);
        } catch (error) {
          console.error('❌ KV persistence error:', error);
        }
      })(),
    );

    const forwardTo = (env.MAIL_FORWARD_TO || env.FORWARD_TO)?.trim();
    if (!forwardTo) {
      console.error('❌ Forwarding rejected: target missing.');
      message.setReject('Mail forwarding is not configured.');
      return;
    }

    if (!isEmailLike(forwardTo)) {
      const errorMsg = 'Forwarding target missing or invalid.';
      console.warn(`⚠️ ${errorMsg}`);
      message.setReject(errorMsg);
      return;
    }

    await message.forward(normalizeEmail(forwardTo));
  },
};
