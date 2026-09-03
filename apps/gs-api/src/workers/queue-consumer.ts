import type { Env } from '../types';
import { isRetryableMailFailure, sendMail } from '../lib/mail';
import {
  isTransactionalMailJob,
  recordMailJobStatus,
} from '../lib/mail-queue';
import { isAutomationQueueJob, processAutomationJob } from '../lib/automation-jobs';

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
  if (type.startsWith('automation.')) return 'automation';
  return 'agent';
};

export async function processQueueBatch(
  batch: MessageBatch<unknown>,
  env: Pick<Env, 'KV' | 'PLATFORM_DB' | 'EMAIL' | 'MAIL_FROM_EMAIL' | 'MAIL_FROM_NAME' | 'BREVO_API_KEY'>,
): Promise<void> {
  for (const message of batch.messages) {
    const idempotencyKey = `queue:v1:${batch.queue}:${message.id}`;

    try {
      if (await env.KV.get(idempotencyKey)) {
        message.ack();
        continue;
      }

      const type = payloadType(message.body);

      if (isAutomationQueueJob(message.body)) {
        await processAutomationJob(env, message.body.jobId);
      }

      if (isTransactionalMailJob(message.body)) {
        const job = message.body;
        await recordMailJobStatus(env, job.jobId, 'processing', {
          incrementAttempts: true,
        });
        const result = await sendMail(
          env,
          job.to,
          job.subject,
          job.text,
          job.html,
          job.replyTo,
        );

        if (result.attempted === false) {
          await recordMailJobStatus(
            env,
            job.jobId,
            'failed',
            { errorCode: result.reason },
          );
          await env.KV.put(idempotencyKey, new Date().toISOString(), {
            expirationTtl: IDEMPOTENCY_TTL_SECONDS,
          });
          message.ack();
          continue;
        }

        if (!result.ok) {
          const retryable = isRetryableMailFailure(result);
          await recordMailJobStatus(env, job.jobId, retryable ? 'retrying' : 'failed', {
            errorCode: result.body,
          });
          if (retryable) throw new Error(`MAIL_RETRYABLE:${result.body}`);

          await env.KV.put(idempotencyKey, new Date().toISOString(), {
            expirationTtl: IDEMPOTENCY_TTL_SECONDS,
          });
          message.ack();
          continue;
        }

        await recordMailJobStatus(env, job.jobId, 'sent', {
          messageId: result.body,
        });
      }

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

