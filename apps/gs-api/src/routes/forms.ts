import { Hono } from 'hono';

const forms = new Hono();

forms.post('/:formId/submissions', async (c) => {
  const payload = await c.req.json().catch(() => ({}));
  return c.json({
    status: 'received',
    formId: c.req.param('formId'),
    submission: payload,
    submittedAt: new Date().toISOString(),
  }, 202);
});

forms.get('/leads', (c) => c.json({ leads: [], source: 'forms' }));

export default forms;
