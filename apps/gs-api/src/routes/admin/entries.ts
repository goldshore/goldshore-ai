import { Hono } from 'hono';
import { verifyAdminAuth, parsePagination, errorHandler } from './middleware/auth';
import * as entriesDb from './db/entries';

const entries = new Hono();

// Apply auth middleware
entries.use('*', verifyAdminAuth);
entries.use('*', parsePagination);

/**
 * GET /api/admin/entries
 * List all entries (contacts + leads combined)
 */
entries.get('/', errorHandler(async (c) => {
  const db = c.env.DB;
  const { offset, limit } = c.get('pagination');

  const contacts = await entriesDb.getContacts(db, { offset: 0, limit: 1000 });
  const leads = await entriesDb.getLeads(db, { offset: 0, limit: 1000 });

  const allItems = [
    ...contacts.items.map((item: any) => ({ ...item, type: 'contact' })),
    ...leads.items.map((item: any) => ({ ...item, type: 'lead' })),
  ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(offset, offset + limit);

  return c.json({
    items: allItems,
    total: contacts.total + leads.total,
    offset,
    limit,
    page: Math.floor(offset / limit) + 1,
  });
}));

/**
 * GET /api/admin/entries/contacts
 * List contact form submissions
 */
entries.get('/contacts', errorHandler(async (c) => {
  const db = c.env.DB;
  const { offset, limit } = c.get('pagination');

  const result = await entriesDb.getContacts(db, {
    offset,
    limit,
    status: c.req.query('status'),
    dateFrom: c.req.query('dateFrom'),
    dateTo: c.req.query('dateTo'),
  });

  return c.json(result);
}));

/**
 * GET /api/admin/entries/contacts/:id
 * Get single contact submission
 */
entries.get('/contacts/:id', errorHandler(async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  const contact = await entriesDb.getEntryById(db, id, 'contacts');
  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404);
  }

  return c.json(contact);
}));

/**
 * POST /api/admin/entries/contacts/:id/respond
 * Mark contact as responded
 */
entries.post('/contacts/:id/respond', errorHandler(async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const user = c.get('user');
  const body = await c.req.json();

  await entriesDb.updateContactStatus(db, id, 'responded', body.notes);

  console.log(`[AUDIT] ${user.email} marked contact ${id} as responded`);

  return c.json({ success: true, message: 'Contact marked as responded' });
}));

/**
 * GET /api/admin/entries/leads
 * List lead submissions
 */
entries.get('/leads', errorHandler(async (c) => {
  const db = c.env.DB;
  const { offset, limit } = c.get('pagination');

  const result = await entriesDb.getLeads(db, {
    offset,
    limit,
    status: c.req.query('status'),
    source: c.req.query('source'),
    dateFrom: c.req.query('dateFrom'),
    dateTo: c.req.query('dateTo'),
  });

  return c.json(result);
}));

/**
 * GET /api/admin/entries/leads/:id
 * Get single lead
 */
entries.get('/leads/:id', errorHandler(async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  const lead = await entriesDb.getEntryById(db, id, 'leads');
  if (!lead) {
    return c.json({ error: 'Lead not found' }, 404);
  }

  return c.json(lead);
}));

/**
 * POST /api/admin/entries/leads/:id
 * Update lead status
 */
entries.post('/leads/:id', errorHandler(async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const user = c.get('user');
  const body = await c.req.json();

  await entriesDb.updateLeadStatus(db, id, body.status, body.assignedTo);

  console.log(`[AUDIT] ${user.email} updated lead ${id} status to ${body.status}`);

  return c.json({ success: true, message: 'Lead updated' });
}));

/**
 * DELETE /api/admin/entries/leads/:id
 * Delete lead
 */
entries.delete('/leads/:id', errorHandler(async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const user = c.get('user');

  await entriesDb.deleteEntry(db, id, 'leads');

  console.log(`[AUDIT] ${user.email} deleted lead ${id}`);

  return c.json({ success: true, message: 'Lead deleted' });
}));

/**
 * DELETE /api/admin/entries/contacts/:id
 * Delete contact submission
 */
entries.delete('/contacts/:id', errorHandler(async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const user = c.get('user');

  await entriesDb.deleteEntry(db, id, 'contacts');

  console.log(`[AUDIT] ${user.email} deleted contact ${id}`);

  return c.json({ success: true, message: 'Contact deleted' });
}));

export default entries;
