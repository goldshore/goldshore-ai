import assert from 'node:assert/strict';
import test from 'node:test';
import { sendMail } from '../lib/mail';

test('uses the native Email Service binding with text and html alternatives', async () => {
  let payload: Record<string, unknown> | undefined;
  const result = await sendMail(
    {
      EMAIL: {
        async send(message: Record<string, unknown>) {
          payload = message;
          return { messageId: 'mail-1' };
        },
      } as any,
      MAIL_FROM_EMAIL: 'noreply@goldshore.ai',
      MAIL_FROM_NAME: 'GoldShore',
    },
    [{ email: 'recipient@example.com' }],
    'Subject',
    'Plain text',
    '<p>HTML</p>',
  );

  assert.deepEqual(result, { attempted: true, ok: true, status: 202, body: 'mail-1' });
  assert.equal(payload?.text, 'Plain text');
  assert.equal(payload?.html, '<p>HTML</p>');
  assert.deepEqual(payload?.from, { email: 'noreply@goldshore.ai', name: 'GoldShore' });
});

test('classifies a missing binding without making an HTTP fallback call', async () => {
  const result = await sendMail(
    {},
    [{ email: 'recipient@example.com' }],
    'Subject',
    'Plain text',
    '<p>HTML</p>',
  );
  assert.deepEqual(result, { attempted: false, reason: 'missing_mail_configuration' });
});
