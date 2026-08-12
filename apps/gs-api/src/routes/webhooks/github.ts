import { Hono } from 'hono';
import crypto from 'crypto';

export const webhooks = new Hono();

interface WebhookEnv {
  Bindings: {
    INTEGRATION_MASTER_KEY: any;
    AUDIT_DB: D1Database;
    KV: KVNamespace;
  };
}

// Middleware: Verify webhook signature
webhooks.use('*', async (c, next) => {
  const signature = c.req.header('X-Hub-Signature-256');
  const payload = await c.req.text();

  if (!signature) {
    return c.json({ error: 'Missing webhook signature' }, 401);
  }

  const secret = c.env.INTEGRATION_MASTER_KEY?.get('GITHUB_APP_WEBHOOK_SECRET');
  if (!secret) {
    console.error('Webhook secret not configured');
    return c.json({ error: 'Webhook secret not configured' }, 500);
  }

  const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const expectedSignature = `sha256=${hash}`;

  if (!crypto.timingSafeEqual(signature, expectedSignature)) {
    return c.json({ error: 'Invalid webhook signature' }, 401);
  }

  // Store parsed payload in context
  c.set('payload', JSON.parse(payload));
  await next();
});

// Log webhook to D1
async function logWebhookEvent(
  db: D1Database,
  eventType: string,
  payload: any,
  repository: string
) {
  const eventId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  try {
    await db.prepare(
      `INSERT INTO webhook_logs (id, event_type, repository, payload, timestamp, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(eventId, eventType, repository, JSON.stringify(payload), timestamp, 'received').run();
  } catch (error) {
    console.error('Failed to log webhook:', error);
  }

  return eventId;
}

// Push event handler
webhooks.post('/push', async (c) => {
  const payload = c.get('payload');
  const repository = payload.repository.full_name;
  const branch = payload.ref.replace('refs/heads/', '');
  const commits = payload.commits || [];
  const pusher = payload.pusher.name;

  const eventId = await logWebhookEvent(c.env.AUDIT_DB, 'push', payload, repository);

  try {
    // Only process main and preview branches
    if (!['main', 'preview'].includes(branch)) {
      return c.json({ success: true, skipped: true, reason: 'Branch not main or preview' });
    }

    // Update deployment cache in KV
    const deploymentInfo = {
      branch,
      latestCommit: payload.head_commit?.id,
      pushedBy: pusher,
      commitCount: commits.length,
      timestamp: new Date().toISOString(),
    };

    await c.env.KV.put(
      `deployment:${branch}:latest`,
      JSON.stringify(deploymentInfo),
      { expirationTtl: 86400 } // 24 hours
    );

    // Log to audit trail
    await c.env.AUDIT_DB.prepare(
      `INSERT INTO audit_logs (id, action, entity_type, entity_id, details, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      'github:push',
      'deployment',
      branch,
      JSON.stringify({ commits: commits.length, pushedBy: pusher }),
      new Date().toISOString()
    ).run();

    // Trigger deployment workflow for main/preview
    // (GitHub Actions will handle this via workflow_run event)

    return c.json({ success: true, eventId, branch, commits: commits.length });
  } catch (error) {
    console.error('Push webhook handler error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Pull request event handler
webhooks.post('/pull_request', async (c) => {
  const payload = c.get('payload');
  const action = payload.action;
  const pr = payload.pull_request;
  const repository = payload.repository.full_name;

  const eventId = await logWebhookEvent(c.env.AUDIT_DB, 'pull_request', payload, repository);

  try {
    // Auto-label PRs based on files changed
    if (action === 'opened' || action === 'synchronize') {
      const changedFiles = pr.changed_files || 0;
      const labels = [];

      // Determine labels based on changed files
      const filesChanged = pr.title.toLowerCase();
      if (filesChanged.includes('api') || filesChanged.includes('worker')) labels.push('component:api');
      if (filesChanged.includes('web') || filesChanged.includes('frontend')) labels.push('component:web');
      if (filesChanged.includes('infra') || filesChanged.includes('cloudflare')) labels.push('component:infra');

      // Cache PR info
      await c.env.KV.put(
        `pr:${repository}:${pr.number}`,
        JSON.stringify({
          number: pr.number,
          title: pr.title,
          author: pr.user.login,
          labels,
          baseRef: pr.base.ref,
          headRef: pr.head.ref,
          createdAt: pr.created_at,
        }),
        { expirationTtl: 2592000 } // 30 days
      );
    }

    // Log PR action to audit trail
    await c.env.AUDIT_DB.prepare(
      `INSERT INTO audit_logs (id, action, entity_type, entity_id, details, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `github:pr:${action}`,
      'pull_request',
      `${repository}#${pr.number}`,
      JSON.stringify({ title: pr.title, author: pr.user.login }),
      new Date().toISOString()
    ).run();

    return c.json({ success: true, eventId, action, pr: pr.number });
  } catch (error) {
    console.error('PR webhook handler error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Issues event handler
webhooks.post('/issues', async (c) => {
  const payload = c.get('payload');
  const action = payload.action;
  const issue = payload.issue;
  const repository = payload.repository.full_name;

  const eventId = await logWebhookEvent(c.env.AUDIT_DB, 'issues', payload, repository);

  try {
    // Check for [audit] label and update repo health cache
    const hasAuditLabel = issue.labels.some((label: any) => label.name === 'audit');

    if (hasAuditLabel) {
      // Log audit issue to cache
      await c.env.KV.put(
        `audit:issue:${issue.number}`,
        JSON.stringify({
          number: issue.number,
          title: issue.title,
          severity: issue.labels.find((l: any) => l.name.startsWith('severity:'))?.name || 'medium',
          status: issue.state,
          createdAt: issue.created_at,
          url: issue.html_url,
        }),
        { expirationTtl: 2592000 } // 30 days
      );

      // Mark repo health cache as stale
      await c.env.KV.put('cache:repo_health:stale', 'true', { expirationTtl: 60 });
    }

    // Log issue action to audit trail
    await c.env.AUDIT_DB.prepare(
      `INSERT INTO audit_logs (id, action, entity_type, entity_id, details, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `github:issue:${action}`,
      'issue',
      `${repository}#${issue.number}`,
      JSON.stringify({ title: issue.title, severity: hasAuditLabel ? 'audit' : 'normal' }),
      new Date().toISOString()
    ).run();

    return c.json({ success: true, eventId, action, issue: issue.number });
  } catch (error) {
    console.error('Issues webhook handler error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Workflow run event handler
webhooks.post('/workflow_run', async (c) => {
  const payload = c.get('payload');
  const action = payload.action;
  const workflowRun = payload.workflow_run;
  const repository = payload.repository.full_name;

  const eventId = await logWebhookEvent(c.env.AUDIT_DB, 'workflow_run', payload, repository);

  try {
    if (action === 'completed') {
      const status = workflowRun.conclusion; // success, failure, neutral, cancelled, skipped, timed_out
      const deploymentInfo = {
        workflowRunId: workflowRun.id,
        name: workflowRun.name,
        status,
        branch: workflowRun.head_branch,
        commitSha: workflowRun.head_sha,
        completedAt: workflowRun.updated_at,
        runNumber: workflowRun.run_number,
        logUrl: workflowRun.html_url,
      };

      // Cache workflow result
      await c.env.KV.put(
        `workflow:${workflowRun.id}`,
        JSON.stringify(deploymentInfo),
        { expirationTtl: 604800 } // 7 days
      );

      // Log to deployment timeline
      await c.env.AUDIT_DB.prepare(
        `INSERT INTO audit_logs (id, action, entity_type, entity_id, details, timestamp, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        'github:workflow:completed',
        'deployment',
        workflowRun.head_branch,
        JSON.stringify(deploymentInfo),
        new Date().toISOString(),
        status === 'success' ? 'success' : 'failure'
      ).run();
    }

    return c.json({ success: true, eventId, action, status: workflowRun.conclusion });
  } catch (error) {
    console.error('Workflow run webhook handler error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Catch all webhook endpoint
webhooks.post('/*', async (c) => {
  const payload = c.get('payload');
  const repository = payload.repository?.full_name || 'unknown';
  const eventType = c.req.header('X-GitHub-Event') || 'unknown';

  // Log unhandled webhook events
  await logWebhookEvent(c.env.AUDIT_DB, eventType, payload, repository);

  return c.json({ success: true, message: 'Webhook received (unhandled event type)' });
});

export default webhooks;
