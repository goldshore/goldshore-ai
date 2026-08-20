import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import mailOperations, { isManagedMailboxAddress, safeAudienceCsvCell } from './admin/mail-operations';
import type { Env, Variables } from '../types';

describe('mailbox and audience safeguards', () => {
  it('limits managed mailboxes to GoldShore domains', () => {
    assert.equal(isManagedMailboxAddress('sales@goldshore.ai'), true);
    assert.equal(isManagedMailboxAddress('hello@goldshore.org'), true);
    assert.equal(isManagedMailboxAddress('admin@example.com'), false);
  });
  it('neutralizes spreadsheet formulas in audience CSV exports', () => {
    assert.equal(safeAudienceCsvCell('=HYPERLINK("https://evil")'), '"\'=HYPERLINK(""https://evil"")"');
    assert.equal(safeAudienceCsvCell('safe@example.com'), '"safe@example.com"');
  });
  it('denies mailbox creation to viewers before storage access', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => { c.set('accessClaims', { roles: ['viewer'], email: 'viewer@goldshore.ai' }); await next(); });
    app.route('/admin', mailOperations);
    const response = await app.request('/admin/mailboxes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }, {} as Env);
    assert.equal(response.status, 403);
  });
});
