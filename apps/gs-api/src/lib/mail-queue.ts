import type { Env } from '../types';
import type { MailRecipient, MailResult } from './mail';

export const TRANSACTIONAL_MAIL_EVENT = 'mail.transactional.v1' as const;

export type TransactionalMailJob = {
  type: typeof TRANSACTIONAL_MAIL_EVENT;
  jobId: string;
  to: MailRecipient[];
  subject: string;
  text: string;
  html: string;
  replyTo?: MailRecipient;
  createdAt: string;
};

type MailQueueEnv = Pick<Env, 'MAIL_JOBS_QUEUE' | 'PLATFORM_DB'>;

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const isTransactionalMailJob = (value: unknown): value is TransactionalMailJob => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TransactionalMailJob>;
  return (
    candidate.type === TRANSACTIONAL_MAIL_EVENT &&
    typeof candidate.jobId === 'string' &&
    Array.isArray(candidate.to) &&
    candidate.to.length > 0 &&
    typeof candidate.subject === 'string' &&
    typeof candidate.text === 'string' &&
    typeof candidate.html === 'string' &&
    typeof candidate.createdAt === 'string'
  );
};

export async function recordMailJobStatus(
  env: Pick<Env, 'PLATFORM_DB'>,
  jobId: string,
  status: 'queued' | 'processing' | 'retrying' | 'sent' | 'failed',
  details: { messageId?: string; errorCode?: string; incrementAttempts?: boolean } = {},
) {
  await env.PLATFORM_DB.prepare(
    `UPDATE mail_jobs
       SET status = ?,
           message_id = COALESCE(?, message_id),
           last_error_code = ?,
           attempts = attempts + ?,
           sent_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  )
    .bind(
      status,
      details.messageId ?? null,
      details.errorCode ?? null,
      details.incrementAttempts ? 1 : 0,
      status,
      jobId,
    )
    .run();
}

export async function enqueueMailJob(
  env: MailQueueEnv,
  input: Omit<TransactionalMailJob, 'type' | 'jobId' | 'createdAt'>,
): Promise<MailResult> {
  if (!env.MAIL_JOBS_QUEUE) {
    return { attempted: false, reason: 'missing_mail_queue' };
  }

  const job: TransactionalMailJob = {
    ...input,
    type: TRANSACTIONAL_MAIL_EVENT,
    jobId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const recipientHash = await sha256(
    job.to.map((recipient) => recipient.email.trim().toLowerCase()).sort().join(','),
  );
  const subjectHash = await sha256(job.subject);

  await env.PLATFORM_DB.prepare(
    `INSERT INTO mail_jobs
      (id, event_type, status, recipient_count, recipient_hash, subject_hash, attempts, created_at, updated_at)
     VALUES (?, ?, 'queued', ?, ?, ?, 0, ?, ?)`,
  )
    .bind(
      job.jobId,
      job.type,
      job.to.length,
      recipientHash,
      subjectHash,
      job.createdAt,
      job.createdAt,
    )
    .run();

  try {
    await env.MAIL_JOBS_QUEUE.send(job);
    return { attempted: true, ok: true, status: 202, body: job.jobId };
  } catch (error) {
    await recordMailJobStatus(env, job.jobId, 'failed', {
      errorCode: 'QUEUE_SEND_FAILED',
    }).catch(() => undefined);
    console.error({ event: 'mail_enqueue_failed', jobId: job.jobId, error: String(error) });
    return { attempted: true, ok: false, status: 503, body: 'QUEUE_SEND_FAILED' };
  }
}
