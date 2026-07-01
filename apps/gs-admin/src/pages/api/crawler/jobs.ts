import type { APIRoute } from 'astro';
import { validateDomain, createCrawlJob, extractEmails, extractPhones, processCrawlResult } from '../../../lib/crawler-config';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const runtime = locals['runtime'] as Record<string, unknown> | undefined;
    const kv = runtime?.env?.['KV'] as Record<string, unknown> | undefined;

    if (!kv || typeof kv.list !== 'function') {
      return new Response(
        JSON.stringify({ jobs: [], total: 0, error: 'Storage unavailable' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // List all crawl jobs
    const listResult = await (kv.list as Function)({ prefix: 'crawler:job:' });
    const keys = listResult.keys || [];

    const jobs = [];
    for (const keyObj of keys) {
      const key = typeof keyObj === 'string' ? keyObj : keyObj.name;
      const job = await (kv.get as Function)(key, 'json');
      if (job) {
        jobs.push(job);
      }
    }

    // Sort by most recent first
    jobs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return new Response(
      JSON.stringify({
        jobs,
        total: jobs.length,
        success: true,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching crawler jobs:', error);
    return new Response(
      JSON.stringify({ jobs: [], total: 0, error: 'Failed to fetch jobs' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { domain } = body;

    if (!domain || typeof domain !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!validateDomain(domain)) {
      return new Response(
        JSON.stringify({ error: 'Invalid domain format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const runtime = locals['runtime'] as Record<string, unknown> | undefined;
    const kv = runtime?.env?.['KV'] as Record<string, unknown> | undefined;

    if (!kv || typeof kv.put !== 'function') {
      return new Response(
        JSON.stringify({ error: 'Storage unavailable' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const crawlJob = createCrawlJob(domain);
    const jobKey = `crawler:job:${crawlJob.id}`;

    // Store the job
    await (kv.put as Function)(jobKey, JSON.stringify(crawlJob));

    // Queue the crawl (in a real system, this would trigger a Worker)
    // For now, we'll simulate an async crawl by storing it as pending
    crawlJob.status = 'pending';

    return new Response(
      JSON.stringify({
        success: true,
        job: crawlJob,
        message: 'Crawl job created. Processing will begin shortly.',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating crawler job:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create job' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
