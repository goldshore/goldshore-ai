import test from 'node:test';
import assert from 'node:assert/strict';
import { suppressBrevoContact, upsertBrevoContact, verifyBrevoConnection } from './brevo';

const secret = (value: string) => ({ async get() { return value; } });

test('Brevo integration fails closed when its Secrets Store binding is absent', async () => {
  assert.deepEqual(await verifyBrevoConnection({} as any), {
    configured: false,
    ok: false,
    status: 0,
    code: 'BREVO_NOT_CONFIGURED',
  });
});

test('confirmed contact sync sends consent metadata without logging or returning the key', async () => {
  const originalFetch = globalThis.fetch;
  let request: Request | undefined;
  globalThis.fetch = async (input, init) => {
    request = new Request(input, init);
    return new Response(null, { status: 204 });
  };
  try {
    const result = await upsertBrevoContact({ BREVO_API_KEY: secret('private-key') } as any, {
      email: 'member@example.com',
      firstName: 'Member',
      lifecycleStage: 'subscriber',
      consentAt: '2026-08-22T12:00:00Z',
      consentSource: 'goldshore-newsletter',
      consentVersion: '2026-08',
    });
    assert.equal(result.ok, true);
    assert.equal(request?.headers.get('api-key'), 'private-key');
    const payload = await request?.json() as any;
    assert.equal(payload.updateEnabled, true);
    assert.equal(payload.emailBlacklisted, false);
    assert.equal(payload.attributes.CONSENT_SOURCE, 'goldshore-newsletter');
    assert.doesNotMatch(JSON.stringify(result), /private-key/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('suppression uses the encoded contact identifier and never deletes provider history', async () => {
  const originalFetch = globalThis.fetch;
  let request: Request | undefined;
  globalThis.fetch = async (input, init) => {
    request = new Request(input, init);
    return new Response(null, { status: 204 });
  };
  try {
    await suppressBrevoContact({ BREVO_API_KEY: secret('private-key') } as any, 'member+tag@example.com');
    assert.match(request?.url ?? '', /member%2Btag%40example\.com$/);
    assert.equal(request?.method, 'PUT');
    assert.deepEqual(await request?.json(), { emailBlacklisted: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
