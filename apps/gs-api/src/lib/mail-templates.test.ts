import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActivationCodeEmail,
  buildInvitationEmail,
  buildLeadAutoResponder,
  buildReceiptEmail,
  buildSecurityAlertEmail,
} from './mail';

test('transactional templates include text and branded HTML without leaking unsafe markup', () => {
  const templates = [
    buildInvitationEmail({ invitationUrl: 'https://goldshore.ai/login?invite=abc', role: '<admin>' }),
    buildActivationCodeEmail({ code: '123456' }),
    buildSecurityAlertEmail({ action: 'New sign-in', occurredAt: '2026-08-22T12:00:00Z', reviewUrl: 'https://admin.goldshore.ai/audit' }),
    buildReceiptEmail({ receiptNumber: 'GS-1001', amount: '$125.00', description: 'Platform services' }),
    buildLeadAutoResponder({ name: '<Customer>', formType: 'contact' }),
  ];

  for (const template of templates) {
    assert.ok(template.subject.length > 0);
    assert.ok(template.text.length > 20);
    assert.match(template.html, /GOLDSHORE/);
    assert.match(template.html, /<!doctype html>/);
  }
  assert.doesNotMatch(templates[0].html, /<admin>/);
  assert.doesNotMatch(templates[4].html, /<Customer>/);
});

test('security and receipt templates expose the operational details in both formats', () => {
  const alert = buildSecurityAlertEmail({ action: 'Password changed', occurredAt: 'now', location: 'New York, US', reviewUrl: 'https://admin.goldshore.ai/audit' });
  assert.match(alert.text, /New York, US/);
  assert.match(alert.html, /Review account activity/);

  const receipt = buildReceiptEmail({ receiptNumber: 'GS-9', amount: '$9.00', description: 'Subscription', receiptUrl: 'https://goldshore.ai/receipts/GS-9' });
  assert.match(receipt.text, /\$9\.00/);
  assert.match(receipt.html, /View receipt/);
});
