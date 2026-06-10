import { Hono } from 'hono';
import { DOMAIN_REGISTRY } from '@goldshore/shared/domain-registry';

const domains = new Hono();

domains.get('/', (c) => c.json({ domains: DOMAIN_REGISTRY }));

domains.get('/:domain', (c) => {
  const target = c.req.param('domain').toLowerCase();
  const domain = DOMAIN_REGISTRY.find((entry) => entry.hostname === target);
  if (!domain) {
    return c.json({ error: 'Domain not found' }, 404);
  }
  return c.json({ domain });
});

domains.post('/audit', async (c) => {
  const payload = await c.req.json().catch(() => ({}));
  return c.json({
    status: 'queued',
    pipeline: 'domain-audit',
    requestedBy: payload?.requestedBy ?? 'unknown',
    timestamp: new Date().toISOString(),
  });
});

export default domains;
