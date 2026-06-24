import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import worker from './index';

class MockMessage {
  from: string;
  to: string;
  headers: Headers;
  forwardedTo: string[] = [];
  rejection?: string;

  constructor(from: string, to: string, subject: string) {
    this.from = from;
    this.to = to;
    this.headers = new Headers({ subject });
  }

  async forward(target: string): Promise<void> {
    this.forwardedTo.push(target);
  }

  setReject(reason: string): void {
    this.rejection = reason;
  }
}

class MockKV {
  private payload: string | null;
  puts: Array<{ key: string; value: string }> = [];

  constructor(payload: string | null) {
    this.payload = payload;
  }

  async get(): Promise<string | null> {
    return this.payload;
  }

  async put(key: string, value: string): Promise<void> {
    this.puts.push({ key, value });
    this.payload = value;
  }
}

const uuidFromIndex = (index: number) =>
  `${index.toString(16).padStart(8, '0')}-aaaa-4aaa-8aaa-${index
    .toString(16)
    .padStart(12, '0')}`;

afterEach(() => {
  mock.restoreAll();
});

describe('gs-mail email handler persistence', () => {
  it('prepends a new log entry to existing EMAIL_INBOX_LOGS', async () => {
    mock.method(
      globalThis.crypto,
      'randomUUID',
      () => '11111111-1111-4111-8111-111111111111',
    );

    const kv = new MockKV(
      JSON.stringify([
        {
          id: uuidFromIndex(1),
          from: 'old@goldshore.ai',
          to: 'inbox@goldshore.ai',
          subject: 'Older',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
    const waits: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
    } as ExecutionContext;
    const message = new MockMessage(
      'sender@goldshore.ai',
      'inbox@goldshore.ai',
      'Hello',
    );

    await worker.email(
      message as unknown as ForwardableEmailMessage,
      {
        GS_CONFIG: kv as unknown as KVNamespace,
        MAIL_FORWARD_TO: 'ops@goldshore.ai',
      },
      ctx,
    );
    await Promise.all(waits);

    assert.equal(message.forwardedTo[0], 'ops@goldshore.ai');
    const payload = JSON.parse(kv.puts[0].value);
    assert.equal(payload.length, 2);
    assert.equal(payload[0].id, '11111111-1111-4111-8111-111111111111');
    assert.equal(payload[1].id, uuidFromIndex(1));
  });

  it('keeps only the most recent 100 entries', async () => {
    mock.method(
      globalThis.crypto,
      'randomUUID',
      () => '22222222-2222-4222-8222-222222222222',
    );

    const existing = Array.from({ length: 100 }, (_, index) => ({
      id: uuidFromIndex(index + 10),
      from: `from-${index}@goldshore.ai`,
      to: 'inbox@goldshore.ai',
      subject: `Subject ${index}`,
      timestamp: new Date(2026, 0, 1, 0, index).toISOString(),
    }));

    const kv = new MockKV(JSON.stringify(existing));
    const waits: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
    } as ExecutionContext;
    const message = new MockMessage(
      'next@goldshore.ai',
      'inbox@goldshore.ai',
      'Newest',
    );

    await worker.email(
      message as unknown as ForwardableEmailMessage,
      {
        GS_CONFIG: kv as unknown as KVNamespace,
        MAIL_FORWARD_TO: 'ops@goldshore.ai',
      },
      ctx,
    );
    await Promise.all(waits);

    const payload = JSON.parse(kv.puts[0].value);
    assert.equal(payload.length, 100);
    assert.equal(payload[0].id, '22222222-2222-4222-8222-222222222222');
    assert.equal(payload[99].id, uuidFromIndex(108));
  });

  it('handles malformed existing KV payloads without crashing', async () => {
    mock.method(
      globalThis.crypto,
      'randomUUID',
      () => '33333333-3333-4333-8333-333333333333',
    );
    const parseErrorSpy = mock.method(console, 'error', () => {});

    const kv = new MockKV('{ malformed json');
    const waits: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
    } as ExecutionContext;
    const message = new MockMessage(
      'safe@goldshore.ai',
      'inbox@goldshore.ai',
      'Recover',
    );

    await worker.email(
      message as unknown as ForwardableEmailMessage,
      {
        GS_CONFIG: kv as unknown as KVNamespace,
        MAIL_FORWARD_TO: 'ops@goldshore.ai',
      },
      ctx,
    );
    await Promise.all(waits);

    const payload = JSON.parse(kv.puts[0].value);
    assert.equal(payload.length, 1);
    assert.equal(payload[0].id, '33333333-3333-4333-8333-333333333333');
    assert.ok(
      parseErrorSpy.mock.calls.some((call) =>
        String(call.arguments[0]).includes(
          'Failed to parse EMAIL_INBOX_LOGS payload',
        ),
      ),
    );
  });

  it('rejects mail when forwarding is not configured', async () => {
    mock.method(
      globalThis.crypto,
      'randomUUID',
      () => '44444444-4444-4444-8444-444444444444',
    );

    const kv = new MockKV(null);
    const waits: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
    } as ExecutionContext;
    const message = new MockMessage(
      'sender@goldshore.ai',
      'inbox@goldshore.ai',
      'Missing route',
    );

    await worker.email(
      message as unknown as ForwardableEmailMessage,
      { GS_CONFIG: kv as unknown as KVNamespace },
      ctx,
    );
    await Promise.all(waits);

    assert.equal(message.rejection, 'Mail forwarding is not configured.');
    assert.equal(message.forwardedTo.length, 0);
    assert.equal(kv.puts.length, 1);
  });

  it('rejects recipients outside the allowlist', async () => {
    const kv = new MockKV(null);
    const waits: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
    } as ExecutionContext;
    const message = new MockMessage(
      'sender@goldshore.ai',
      'other@goldshore.ai',
      'Blocked recipient',
    );

    await worker.email(
      message as unknown as ForwardableEmailMessage,
      {
        GS_CONFIG: kv as unknown as KVNamespace,
        MAIL_FORWARD_TO: 'ops@goldshore.ai',
        MAIL_ALLOWED_RECIPIENTS: 'inbox@goldshore.ai, support@goldshore.ai',
      },
      ctx,
    );
    await Promise.all(waits);

    assert.equal(
      message.rejection,
      'Recipient other@goldshore.ai is not allowlisted.',
    );
    assert.equal(message.forwardedTo.length, 0);
    assert.equal(kv.puts.length, 0);
  });
});

describe('gs-mail email handler security & error cases', () => {
  it('rejects invalid forwarding targets', async () => {
    const kv = new MockKV(null);
    const waits: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
    } as ExecutionContext;
    const message = new MockMessage(
      'sender@goldshore.ai',
      'inbox@goldshore.ai',
      'No target',
    );

    await worker.email(
      message as unknown as ForwardableEmailMessage,
      {
        GS_CONFIG: kv as unknown as KVNamespace,
        MAIL_FORWARD_TO: 'aaaaaaa@aaaaaaa@',
      },
      ctx,
    );
    await Promise.all(waits);

    assert.equal(message.rejection, 'Forwarding target missing or invalid.');
    assert.equal(message.forwardedTo.length, 0);
  });

  it('allows email if recipient is in MAIL_ALLOWED_RECIPIENTS', async () => {
    const kv = new MockKV(null);
    const waits: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
    } as ExecutionContext;
    const message = new MockMessage(
      'sender@goldshore.ai',
      'inbox@goldshore.ai',
      'Hello',
    );

    const env = {
      GS_CONFIG: kv as unknown as KVNamespace,
      MAIL_FORWARD_TO: 'OPS@GOLDSHORE.AI',
      MAIL_ALLOWED_RECIPIENTS: 'inbox@goldshore.ai,ops@goldshore.ai',
    };

    await worker.email(message as unknown as ForwardableEmailMessage, env, ctx);
    await Promise.all(waits);

    assert.equal(message.rejection, undefined);
    assert.equal(message.forwardedTo[0], 'ops@goldshore.ai');
  });

  it('matches allowlists and blocklists case-insensitively', async () => {
    const kv = new MockKV(null);
    const waits: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
    } as ExecutionContext;
    const blockedMessage = new MockMessage(
      'Sender@GoldShore.ai',
      'Inbox@GoldShore.ai',
      'Blocked',
    );

    await worker.email(
      blockedMessage as unknown as ForwardableEmailMessage,
      {
        GS_CONFIG: kv as unknown as KVNamespace,
        MAIL_FORWARD_TO: 'ops@goldshore.ai',
        MAIL_BLOCKED_SENDERS: 'sender@goldshore.ai',
      },
      ctx,
    );
    await Promise.all(waits);

    assert.equal(
      blockedMessage.rejection,
      'Sender Sender@GoldShore.ai is blocked.',
    );
  });

  it('truncates subject to 50 characters in KV logs', async () => {
    const longSubject = 'A'.repeat(100);
    const kv = new MockKV(null);
    const waits: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
    } as ExecutionContext;
    const message = new MockMessage(
      'sender@goldshore.ai',
      'inbox@goldshore.ai',
      longSubject,
    );

    await worker.email(
      message as unknown as ForwardableEmailMessage,
      {
        GS_CONFIG: kv as unknown as KVNamespace,
        MAIL_FORWARD_TO: 'ops@goldshore.ai',
      },
      ctx,
    );
    await Promise.all(waits);

    const payload = JSON.parse(kv.puts[0].value);
    assert.equal(payload[0].subject.length, 50);
    assert.equal(payload[0].subject, 'A'.repeat(50));
  });
});
