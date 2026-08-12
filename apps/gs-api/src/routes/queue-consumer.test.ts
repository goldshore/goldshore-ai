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
