import test from 'node:test';
import assert from 'node:assert/strict';
import invitations from './invitations';

test('invitation acceptance activates an invited user without returning the token', async () => {
  const queries: string[] = [];
  const env = {
    PLATFORM_DB: {
      prepare(query: string) {
        queries.push(query);
        return {
          bind() {
            return {
              async first() { return { id: 'invite-1', email: 'member@example.com' }; },
              async run() { return { meta: { changes: 1 } }; },
            };
          },
        };
      },
    },
  };
  const response = await invitations.request('/accept', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'a'.repeat(72) }),
  }, env as any);
  const payload = await response.json() as Record<string, unknown>;
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal('token' in payload, false);
  assert.ok(queries.some((query) => query.includes("status='accepted'")));
  assert.ok(queries.some((query) => query.includes("status='active'")));
});

test('invitation acceptance rejects short or missing bearer tokens', async () => {
  const response = await invitations.request('/accept', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'short' }),
  }, { PLATFORM_DB: {} } as any);
  assert.equal(response.status, 400);
});
