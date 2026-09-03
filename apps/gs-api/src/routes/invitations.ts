import { Hono } from 'hono';
import type { Env } from '../types';

const invitations = new Hono<{ Bindings: Env }>();

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

invitations.post('/accept', async (c) => {
  const body = await c.req.json<{ token?: string }>().catch(() => null);
  const token = body?.token?.trim() ?? '';
  if (token.length < 64 || token.length > 256) {
    return c.json({ error: 'This invitation is invalid or expired.' }, 400);
  }

  const tokenHash = await sha256(token);
  const invitation = await c.env.PLATFORM_DB.prepare(
    `SELECT id,email FROM invitations
     WHERE token_hash=? AND status='pending' AND expires_at > datetime('now')
     LIMIT 1`,
  ).bind(tokenHash).first<{ id: string; email: string }>();

  if (!invitation) {
    return c.json({ error: 'This invitation is invalid or expired.' }, 400);
  }

  const accepted = await c.env.PLATFORM_DB.prepare(
    `UPDATE invitations SET status='accepted',accepted_at=datetime('now')
     WHERE id=? AND status='pending' AND expires_at > datetime('now')`,
  ).bind(invitation.id).run();

  if (Number(accepted.meta?.changes ?? 0) !== 1) {
    return c.json({ error: 'This invitation is invalid or expired.' }, 400);
  }

  await c.env.PLATFORM_DB.prepare(
    `UPDATE users SET status='active',disabled_at=NULL,updated_at=datetime('now')
     WHERE email=? COLLATE NOCASE AND status='invited'`,
  ).bind(invitation.email).run();

  return c.json({ ok: true, loginUrl: 'https://admin.goldshore.ai/' });
});

export default invitations;
