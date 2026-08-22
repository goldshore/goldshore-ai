import assert from 'node:assert/strict';
import test from 'node:test';
import { sendMail } from './mail';

test('Brevo sends transactional mail when its API key is configured', async () => {
  const originalFetch = globalThis.fetch;
  let captured: { input?: string; init?: RequestInit } = {};
  globalThis.fetch = async (input, init) => {
    captured = { input: String(input), init };
    return Response.json({ messageId: '<brevo-message@goldshore.ai>' }, { status: 201 });
  };

  try {
    const result = await sendMail(
      { BREVO_API_KEY: { get: async () => 'test-key' }, MAIL_FROM_EMAIL: 'noreply@goldshore.ai', MAIL_FROM_NAME: 'GoldShore' } as any,
      [{ email: 'subscriber@example.com', name: 'Subscriber' }],
      'Confirm your subscription',
      'Text body',
      '<p>HTML body</p>',
    );
    assert.deepEqual(result, { attempted: true, ok: true, status: 202, body: '<brevo-message@goldshore.ai>' });
    assert.equal(captured.input, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(new Headers(captured.init?.headers).get('api-key'), 'test-key');
    const payload = JSON.parse(String(captured.init?.body));
    assert.equal(payload.sender.email, 'noreply@goldshore.ai');
    assert.equal(payload.to[0].email, 'subscriber@example.com');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Brevo errors are sanitized and transient failures remain retryable', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('provider details must not escape', { status: 503 });
  try {
    const result = await sendMail(
      { BREVO_API_KEY: { get: async () => 'test-key' }, MAIL_FROM_EMAIL: 'noreply@goldshore.ai' } as any,
      [{ email: 'subscriber@example.com' }],
      'Subject',
      'Text',
      '<p>HTML</p>',
    );
    assert.deepEqual(result, { attempted: true, ok: false, status: 503, body: 'E_BREVO_503' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
