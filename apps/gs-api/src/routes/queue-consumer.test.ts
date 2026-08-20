import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processQueueBatch } from '../workers/queue-consumer';

test('queue processing records idempotency before acknowledging', async () => {
  const calls: string[] = [];
  const kv = {
    async get() { return null; },
    async put(key: string) { calls.push(`put:${key}`); },
  };
  const message = {
    id: 'message-1',
    body: { type: 'contact' },
    ack() { calls.push('ack'); },
    retry() { calls.push('retry'); },
  };

  await processQueueBatch(
    { queue: 'gs-mail-jobs', messages: [message] } as any,
    { KV: kv } as any,
  );

  assert.deepEqual(calls, ['put:queue:v1:gs-mail-jobs:message-1', 'ack']);
});

test('queue processing acknowledges an already-processed message without rerunning it', async () => {
  const calls: string[] = [];
  const kv = {
    async get() { return 'processed'; },
    async put() { calls.push('put'); },
  };
  const message = {
    id: 'message-1',
    body: { type: 'contact' },
    ack() { calls.push('ack'); },
    retry() { calls.push('retry'); },
  };

  await processQueueBatch(
    { queue: 'gs-mail-jobs', messages: [message] } as any,
    { KV: kv } as any,
  );

  assert.deepEqual(calls, ['ack']);
});

test('queue processing retries when the adapter or idempotency write fails', async () => {
  const calls: string[] = [];
  const kv = {
    async get() { return null; },
    async put() { throw new Error('KV unavailable'); },
  };
  const message = {
    id: 'message-1',
    body: { type: 'signal' },
    ack() { calls.push('ack'); },
    retry() { calls.push('retry'); },
  };

  await processQueueBatch(
    { queue: 'gs-events', messages: [message] } as any,
    { KV: kv } as any,
  );

  assert.deepEqual(calls, ['retry']);
});

test('transactional mail is delivered and recorded before acknowledgement', async () => {
  const calls: string[] = [];
  const env = {
    KV: {
      async get() { return null; },
      async put() { calls.push('idempotency'); },
    },
    PLATFORM_DB: {
      prepare() {
        return {
          bind(status: string) {
            return { async run() { calls.push(`db:${status}`); } };
          },
        };
      },
    },
    EMAIL: {
      async send() {
        calls.push('send');
        return { messageId: 'mail-1' };
      },
    },
    MAIL_FROM_EMAIL: 'noreply@goldshore.ai',
  };
  const message = {
    id: 'message-1',
    body: {
      type: 'mail.transactional.v1',
      jobId: 'job-1',
      to: [{ email: 'recipient@example.com' }],
      subject: 'Hello',
      text: 'Hello',
      html: '<p>Hello</p>',
      createdAt: new Date().toISOString(),
    },
    ack() { calls.push('ack'); },
    retry() { calls.push('retry'); },
  };

  await processQueueBatch(
    { queue: 'gs-mail-jobs', messages: [message] } as any,
    env as any,
  );

  assert.deepEqual(calls, ['db:processing', 'send', 'db:sent', 'idempotency', 'ack']);
});

test('transactional mail retries transient Email Service failures', async () => {
  const calls: string[] = [];
  const env = {
    KV: { async get() { return null; }, async put() { calls.push('idempotency'); } },
    PLATFORM_DB: {
      prepare() {
        return {
          bind(status: string) {
            return { async run() { calls.push(`db:${status}`); } };
          },
        };
      },
    },
    EMAIL: {
      async send() {
        const error = new Error('rate limited') as Error & { code: string };
        error.code = 'E_RATE_LIMIT_EXCEEDED';
        throw error;
      },
    },
  };
  const message = {
    id: 'message-1',
    body: {
      type: 'mail.transactional.v1', jobId: 'job-1',
      to: [{ email: 'recipient@example.com' }], subject: 'Hello',
      text: 'Hello', html: '<p>Hello</p>', createdAt: new Date().toISOString(),
    },
    ack() { calls.push('ack'); },
    retry() { calls.push('retry'); },
  };

  await processQueueBatch(
    { queue: 'gs-mail-jobs', messages: [message] } as any,
    env as any,
  );

  assert.deepEqual(calls, ['db:processing', 'db:retrying', 'retry']);
});
