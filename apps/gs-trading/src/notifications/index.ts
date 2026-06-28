import type { TradingEnv } from '../types';

export type NotificationEvent =
  | 'order_filled'
  | 'order_rejected'
  | 'pnl_threshold'
  | 'agent_recommendation'
  | 'daily_summary';

export async function notify(
  env: TradingEnv,
  db: D1Database,
  event: NotificationEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const promises: Promise<void>[] = [];

  if (env.NOTIFY_EMAIL_WEBHOOK) {
    promises.push(sendWebhook(db, env.NOTIFY_EMAIL_WEBHOOK, 'email', event, body));
  }
  if (env.NOTIFY_WEBHOOK_URL) {
    promises.push(sendWebhook(db, env.NOTIFY_WEBHOOK_URL, 'webhook', event, body));
  }
  if (env.NOTIFY_SMS_WEBHOOK) {
    promises.push(sendWebhook(db, env.NOTIFY_SMS_WEBHOOK, 'sms', event, body));
  }

  await Promise.allSettled(promises);
}

async function sendWebhook(
  db: D1Database,
  url: string,
  channel: 'email' | 'webhook' | 'sms',
  event: string,
  body: string,
): Promise<void> {
  const id = crypto.randomUUID();
  const sentAt = Date.now();
  let success = 1;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) success = 0;
  } catch {
    success = 0;
  }
  await db
    .prepare('INSERT INTO notification_log (id, type, channel, payload, sent_at, success) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, event, channel, body, sentAt, success)
    .run();
}
