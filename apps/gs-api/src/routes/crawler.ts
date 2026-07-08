import { Hono } from 'hono';
import { Env, Variables } from '../types';

type CrawlJob = {
  id: string;
  domain: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  leadsFound: number;
  emailsFound: string[];
  phonesFound: string[];
  error?: string;
};

const crawler = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

const validateDomain = (domain: string): boolean => {
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  return domainRegex.test(domain);
};

const createCrawlJob = (domain: string): CrawlJob => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
  domain,
  status: 'pending',
  startedAt: new Date().toISOString(),
  leadsFound: 0,
  emailsFound: [],
  phonesFound: [],
});

crawler.get('/jobs', async (c) => {
  try {
    const { keys } = await c.env.KV.list({ prefix: 'crawler:job:' });
    const jobs = (await Promise.all(keys.map((key) => c.env.KV.get<CrawlJob>(key.name, 'json'))))
      .filter(Boolean) as CrawlJob[];

    jobs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return c.json({ jobs, total: jobs.length, success: true });
  } catch (error) {
    console.error('Error fetching crawler jobs:', error);
    return c.json({ jobs: [], total: 0, error: 'Failed to fetch jobs' }, 500);
  }
});

crawler.post('/jobs', async (c) => {
  try {
    const body = await c.req.json<{ domain?: unknown }>();
    const domain = typeof body.domain === 'string' ? body.domain.trim() : '';

    if (!domain) {
      return c.json({ error: 'Domain is required' }, 400);
    }

    if (!validateDomain(domain)) {
      return c.json({ error: 'Invalid domain format' }, 400);
    }

    const crawlJob = createCrawlJob(domain);
    await c.env.KV.put(`crawler:job:${crawlJob.id}`, JSON.stringify(crawlJob));

    return c.json({
      success: true,
      job: crawlJob,
      message: 'Crawl job created. Processing will begin shortly.',
    }, 201);
  } catch (error) {
    console.error('Error creating crawler job:', error);
    return c.json({ error: 'Failed to create job' }, 500);
  }
});

export default crawler;
