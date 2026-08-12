import { Hono } from 'hono';
import { requirePermission, getActor, logAdminAction } from '../auth';
import { Env, Variables } from '../types';
import {
  buildPullRequestDraft,
  createDryRunPlan,
  getAssistantTemplate,
  getGitHubToken,
  searchAssistantTemplates,
} from '../lib/deploy-assistant';

const deployments = new Hono<{ Bindings: Env; Variables: Variables }>();

deployments.get('/', requirePermission('system:read'), async (c) => {
  return c.json({ deployments: [] });
});

deployments.get('/assistant/search', requirePermission('system:read'), async (c) => {
  const query = c.req.query('q') ?? '';
  const cloudflareNativeOnly = c.req.query('cloudflareNativeOnly') !== 'false';
  const securityOnly = c.req.query('securityOnly') !== 'false';
  const actor = getActor(c.get('accessClaims'), c.req.raw);

  const result = await searchAssistantTemplates(c.env, query, {
    cloudflareNativeOnly,
    securityOnly,
  });

  await logAdminAction(c.env, {
    action: 'admin.deploy.search',
    actor,
    status: 'success',
    metadata: {
      query,
      cloudflareNativeOnly,
      securityOnly,
      resultCount: result.recommendations.length,
    },
  });

  return c.json({ success: true, data: result });
});

deployments.post('/assistant/stream', requirePermission('system:read'), async (c) => {
  const body = await c.req.json().catch(() => ({})) as {
    query?: string;
    cloudflareNativeOnly?: boolean;
    securityOnly?: boolean;
  };
  const query = body.query ?? '';
  const result = await searchAssistantTemplates(c.env, query, {
    cloudflareNativeOnly: body.cloudflareNativeOnly ?? true,
    securityOnly: body.securityOnly ?? true,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (event: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
        );
      };

      write('start', { query: result.query, total: result.recommendations.length });
      result.recommendations.forEach((recommendation, index) => {
        write('recommendation', {
          index,
          id: recommendation.id,
          name: recommendation.name,
          score: recommendation.score,
          deploymentModel: recommendation.deploymentModel,
          cloudflareNative: recommendation.cloudflareNative,
          securityVetted: recommendation.securityVetted,
          summary: recommendation.summary,
        });
      });
      write('complete', {
        summary: result.summary,
        total: result.recommendations.length,
      });
      controller.close();
    },
  });

  await logAdminAction(c.env, {
    action: 'admin.deploy.stream',
    actor: getActor(c.get('accessClaims'), c.req.raw),
    status: 'success',
    metadata: {
      query,
      count: result.recommendations.length,
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
});

deployments.post('/assistant/dry-run', requirePermission('system:write'), async (c) => {
  const body = await c.req.json().catch(() => ({})) as {
    templateId?: string;
    workspace?: string;
  };

  if (!body.templateId) {
    return c.json({ success: false, error: 'templateId is required.' }, 400);
  }

  const template = getAssistantTemplate(body.templateId);
  if (!template) {
    return c.json({ success: false, error: 'Unknown templateId.' }, 404);
  }

  if (!template.cloudflareNative || !template.securityVetted) {
    return c.json({ success: false, error: 'Only Cloudflare-native, security-vetted templates are allowed.' }, 400);
  }

  const plan = createDryRunPlan(template, body.workspace ?? 'apps/gs-web');

  await logAdminAction(c.env, {
    action: 'admin.deploy.dry_run',
    actor: getActor(c.get('accessClaims'), c.req.raw),
    status: 'success',
    metadata: {
      templateId: template.id,
      workspace: plan.workspace,
      deploymentModel: plan.deploymentModel,
    },
  });

  return c.json({
    success: true,
    data: {
      dryRunId: crypto.randomUUID(),
      status: 'queued',
      plan,
    },
  }, 202);
});

deployments.post('/assistant/pr', requirePermission('system:write'), async (c) => {
  const body = await c.req.json().catch(() => ({})) as {
    templateId?: string;
    repository?: string;
    head?: string;
    base?: string;
    query?: string;
    dryRunCommand?: string;
    dryRunPassed?: boolean;
  };

  if (!body.dryRunPassed) {
    return c.json({ success: false, error: 'Dry run must be completed before creating a PR.' }, 400);
  }

  if (!body.templateId || !body.repository || !body.head || !body.base || !body.query || !body.dryRunCommand) {
    return c.json({ success: false, error: 'templateId, repository, head, base, query, and dryRunCommand are required.' }, 400);
  }

  const template = getAssistantTemplate(body.templateId);
  if (!template) {
    return c.json({ success: false, error: 'Unknown templateId.' }, 404);
  }

  const draft = buildPullRequestDraft(template, {
    repository: body.repository,
    head: body.head,
    base: body.base,
    query: body.query,
    dryRunCommand: body.dryRunCommand,
  });

  const token = getGitHubToken(c.env);
  if (!token) {
    return c.json({
      success: true,
      status: 'draft',
      data: {
        ...draft,
        prUrl: null,
        note: 'Missing GitHub token; returning a draft PR payload for manual creation.',
      },
    }, 202);
  }

  const [owner, repo] = draft.repository.split('/');
  if (!owner || !repo) {
    return c.json({ success: false, error: 'repository must be in owner/repo form.' }, 400);
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: draft.title,
      body: draft.body,
      head: draft.head,
      base: draft.base,
      draft: true,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    return c.json({ success: false, error: `GitHub PR creation failed: ${message}` }, 502);
  }

  const pr = await response.json() as { html_url?: string; number?: number };

  await logAdminAction(c.env, {
    action: 'admin.deploy.pr',
    actor: getActor(c.get('accessClaims'), c.req.raw),
    status: 'success',
    metadata: {
      templateId: template.id,
      repository: draft.repository,
      prNumber: pr.number,
    },
  });

  return c.json({
    success: true,
    status: 'created',
    data: {
      ...draft,
      prUrl: pr.html_url ?? null,
      prNumber: pr.number ?? null,
    },
  }, 201);
});

export default deployments;
