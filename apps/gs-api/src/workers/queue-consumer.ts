import type { Env } from '../types';

const IDEMPOTENCY_TTL_SECONDS = 7 * 24 * 60 * 60;

type QueuePayload = Record<string, unknown> & { type?: unknown };

const payloadType = (body: unknown): string => {
  if (!body || typeof body !== 'object') return 'unknown';
  return String((body as QueuePayload).type ?? 'unknown');
};

const adapterFor = (type: string): string => {
  if (type === 'contact' || type === 'checkout' || type.startsWith('mail.')) return 'mail';
  if (type === 'signal' || type === 'atc' || type.startsWith('signal.')) return 'signals';
  if (type === 'trading' || type === 'trading-signal' || type === 'order') return 'trading';
  return 'agent';
};

export async function processQueueBatch(
  batch: MessageBatch<unknown>,
  env: Pick<Env, 'KV'>,
): Promise<void> {
  for (const message of batch.messages) {
    const idempotencyKey = `queue:v1:${batch.queue}:${message.id}`;

    try {
      if (await env.KV.get(idempotencyKey)) {
        message.ack();
        continue;
      }

      const type = payloadType(message.body);
      console.info({
        event: 'queue_message_processed',
        adapter: adapterFor(type),
        queue: batch.queue,
        messageId: message.id,
        type,
        timestamp: new Date().toISOString(),
      });

      await env.KV.put(idempotencyKey, new Date().toISOString(), {
        expirationTtl: IDEMPOTENCY_TTL_SECONDS,
      });
      message.ack();
    } catch (error) {
      console.error('gs-api queue message processing failed:', {
        queue: batch.queue,
        messageId: message.id,
        error,
      });
      message.retry();
    }
  }
}
