/**
 * Mail Routes
 * Manages email sending, templates, and delivery tracking
 */

import { Router } from 'itty-router';
import type { IRequest } from 'itty-router';

export const mailRouter = Router({ base: '/api/mail' });

mailRouter.post('/send', async (req: IRequest, env: any) => {
  try {
    const body = await req.json();
    const { to, subject, template, data } = body;
    if (!to || !subject) return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    
    const id = crypto.randomUUID();
    const db = env.PLATFORM_DB;
    
    await db.prepare('INSERT INTO mail_queue (id, to_addr, subject, template, data, status, created_at) VALUES (?, ?, ?, ?, ?, "queued", CURRENT_TIMESTAMP)').bind(id, to, subject, template || null, JSON.stringify(data || {})).run();
    
    if (env.MAIL_JOBS_QUEUE) {
      await env.MAIL_JOBS_QUEUE.send({ type: 'send_mail', mail_id: id, to, subject, template, data });
    }
    
    return new Response(JSON.stringify({ id, status: 'queued' }), { status: 202, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to send mail' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});

mailRouter.get('/status/:mail_id', async (req: IRequest, env: any) => {
  try {
    const { mail_id } = req.params;
    const db = env.PLATFORM_DB;
    const mail = await db.prepare('SELECT * FROM mail_queue WHERE id = ?').bind(mail_id).first();
    if (!mail) return new Response(JSON.stringify({ error: 'Mail not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ id: mail.id, status: mail.status, to: mail.to_addr }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch mail status' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});

mailRouter.get('/templates', async (req: IRequest, env: any) => {
  try {
    const db = env.PLATFORM_DB;
    const templates = await db.prepare('SELECT id, name, subject, active FROM mail_templates WHERE active = 1 ORDER BY created_at DESC').all();
    return new Response(JSON.stringify(templates.results || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch templates' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});

export default mailRouter;
