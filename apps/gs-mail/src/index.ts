// Email worker — processes inbound mail forwarded by Cloudflare Email Routing
// and handles queue events from the checkout/contact pipelines.

const EMAIL_INBOX_LOGS_KEY = 'EMAIL_INBOX_LOGS';
const MAX_LOG_ENTRIES = 100;

interface Env {
  GS_CONFIG: KVNamespace;
  MAIL_FORWARD_TO?: string;
  ENV?: string;
}

interface ContactEventPayload {
  type: 'contact';
  name: string;
  email: string;
  message: string;
  timestamp: string;
}

interface CheckoutEventPayload {
  type: 'checkout';
  orderId: string;
  customerEmail: string;
  amount: number;
  currency: string;
  timestamp: string;
}

type QueuePayload = ContactEventPayload | CheckoutEventPayload;

export default {
  // Handles inbound emails forwarded by Cloudflare Email Routing.
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const from = message.from;
    const to = message.to;

    // Check blocked senders stored in GS_CONFIG KV.
    const blockedRaw = await env.GS_CONFIG.get('BLOCKED_SENDERS');
    const blocked = blockedRaw
      ? blockedRaw.split(',').map((s) => s.trim().toLowerCase())
      : [];
    if (blocked.includes(from.toLowerCase())) {
      message.setReject('Sender blocked.');
      return;
    }

    // Log the incoming email — non-fatal if the KV write fails.
    try {
      const logEntry = {
        id: crypto.randomUUID(),
        from,
        to,
        subject: message.headers.get('subject') ?? '(no subject)',
        timestamp: new Date().toISOString(),
      };
      const existing = await env.GS_CONFIG.get(EMAIL_INBOX_LOGS_KEY);
      const logs: typeof logEntry[] = existing ? (JSON.parse(existing) as typeof logEntry[]) : [];
      logs.unshift(logEntry);
      if (logs.length > MAX_LOG_ENTRIES) logs.length = MAX_LOG_ENTRIES;
      await env.GS_CONFIG.put(EMAIL_INBOX_LOGS_KEY, JSON.stringify(logs));
    } catch (err) {
      console.error('Failed to log email:', err);
    }

    // Forward to destination — fail closed if none configured.
    const forwardTo =
      env.MAIL_FORWARD_TO ?? (await env.GS_CONFIG.get('MAIL_FORWARD_TO'));
    if (!forwardTo) {
      message.setReject('No forward destination configured.');
      return;
    }
    await message.forward(forwardTo);
  },

  // Processes checkout and contact events from the queue pipelines.
  async queue(batch: MessageBatch<QueuePayload>, _env: Env): Promise<void> {
    for (const msg of batch.messages) {
      try {
        const payload = msg.body;
        if (payload.type === 'contact') {
          console.log(
            `[gs-mail] contact form submission from ${payload.email} at ${payload.timestamp}`,
          );
        } else if (payload.type === 'checkout') {
          console.log(
            `[gs-mail] checkout order ${payload.orderId} for ${payload.customerEmail}`,
          );
        }
        msg.ack();
      } catch (err) {
        console.error('[gs-mail] queue message processing failed:', err);
        msg.retry();
      }
    }
  },

  async fetch(_req: Request, _env: Env): Promise<Response> {
    return new Response('gs-mail', { status: 200 });
  },
};
