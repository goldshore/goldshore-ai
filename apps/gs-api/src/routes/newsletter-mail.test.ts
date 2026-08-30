import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNewsletterConfirmation,
  buildNewsletterWelcome,
} from '../lib/mail';

test('newsletter confirmation includes the exact confirmation link and activation code', () => {
  const url = 'https://goldshore.ai/newsletter/confirm?token=test-token';
  const message = buildNewsletterConfirmation({ confirmationUrl: url, activationCode: '482901' });
  assert.match(message.subject, /confirm/i);
  assert.match(message.text, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(message.html, /Confirm subscription/);
  assert.match(message.text, /482901/);
  assert.match(message.html, /482901/);
});

test('newsletter welcome includes an unsubscribe link', () => {
  const url = 'https://goldshore.ai/newsletter/unsubscribe?token=manage-token';
  const message = buildNewsletterWelcome({ unsubscribeUrl: url });
  assert.match(message.subject, /confirmed/i);
  assert.match(message.text, /Unsubscribe at any time/);
  assert.match(message.html, /unsubscribe/i);
  assert.ok(message.text.includes(url));
});
