import type { Env, Variables } from '../../types';
import { Hono } from 'hono';
import { requireRbacPermission } from '../../middleware/requireRbacPermission';
import { errorHandler } from './middleware/auth';

const prManager = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * POST /api/admin/pr-manager/create
 * Auto-create GitHub PR from admin changes
 */
prManager.post(
  '/create',
  await requireRbacPermission('perm_workers_update'),
  errorHandler(async (c) => {
    const user = c.get('user');
    const body = (await c.req.json()) as any;
    const token = c.env.GITHUB_TOKEN as string;

    if (!body.title || !body.description || !body.changes) {
      return c.json({ error: 'Missing required fields: title, description, changes' }, 400);
    }

    const prBody = `
${body.description}

## Changes
${body.changes}

---
_Created by admin dashboard (${user.email})_
`;

    const response = await fetch('https://api.github.com/repos/marzton/goldshore-ai/pulls', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title: body.title,
        body: prBody,
        head: body.branch || 'admin-changes',
        base: 'main',
        draft: true,
      }),
    });

    if (!response.ok) {
      return c.json({ error: 'Failed to create PR' }, response.status);
    }

    const pr = (await response.json()) as any;
    return c.json({ pr_url: pr.html_url, pr_number: pr.number }, 201);
  })
);

/**
 * GET /api/admin/pr-manager/open
 * List open admin-related PRs
 */
prManager.get(
  '/open',
  await requireRbacPermission('perm_workers_view'),
  errorHandler(async (c) => {
    const token = c.env.GITHUB_TOKEN as string;

    const response = await fetch(
      'https://api.github.com/repos/marzton/goldshore-ai/pulls?state=open&per_page=20',
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      return c.json({ error: 'Failed to fetch PRs' }, response.status);
    }

    const prs = (await response.json()) as any[];
    return c.json({
      prs: prs
        .filter((pr: any) => pr.title.includes('admin') || pr.labels.some((l: any) => l.name === 'admin'))
        .map((pr: any) => ({
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          author: pr.user.login,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
        })),
    });
  })
);

/**
 * POST /api/admin/pr-manager/:prNumber/merge
 * Merge admin PR
 */
prManager.post(
  '/:prNumber/merge',
  await requireRbacPermission('perm_workers_update'),
  errorHandler(async (c) => {
    const prNumber = c.req.param('prNumber');
    const token = c.env.GITHUB_TOKEN as string;

    const response = await fetch(
      `https://api.github.com/repos/marzton/goldshore-ai/pulls/${prNumber}/merge`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          commit_message: `Merge admin PR #${prNumber}`,
          merge_method: 'squash',
        }),
      }
    );

    if (!response.ok) {
      return c.json({ error: 'Failed to merge PR' }, response.status);
    }

    return c.json({ success: true, message: `PR #${prNumber} merged` });
  })
);

export default prManager;
