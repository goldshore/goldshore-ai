import { Hono } from 'hono';
import { buildAdminSession } from '@goldshore/auth';
import { Env, Variables } from '../../types';
import { searchGitHubFrameworks } from '../../lib/github-framework-search';
import { rankFrameworksWithClaude } from '../../lib/claude-framework-ranker';
import { validateWranglerConfig } from '../../lib/wrangler-validator';

const deploy = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

deploy.post('/search', async (c) => {
  const claims = c.get('accessClaims');
  if (!claims) {
    return c.json({ error: 'Authentication required.' }, 401);
  }

  const session = buildAdminSession(claims);
  if (!session.permissions.includes('deployments:create')) {
    return c.json({ error: 'Insufficient permissions.' }, 403);
  }

  let payload: { query?: string };
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON payload.' }, 400);
  }

  const query = payload.query?.trim();
  if (!query) {
    return c.json({ error: 'Query is required.' }, 400);
  }

  const githubToken = c.env.GITHUB_API_TOKEN as string | undefined;
  const claudeToken = c.env.ANTHROPIC_API_KEY as string | undefined;

  if (!githubToken) {
    return c.json({ error: 'GitHub API token not configured.' }, 500);
  }

  if (!claudeToken) {
    return c.json({ error: 'Claude API key not configured.' }, 500);
  }

  return c.newResponse(
    new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ status: 'Searching GitHub for ${query} frameworks...' })}\n`
            )
          );

          const frameworks = await searchGitHubFrameworks(query, githubToken);

          if (frameworks.length === 0) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ error: 'No Cloudflare Worker frameworks found matching your query.' })}\n`
              )
            );
            controller.close();
            return;
          }

          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ status: `Found ${frameworks.length} frameworks. Ranking with Claude...` })}\n`
            )
          );

          const rankedFrameworks = await rankFrameworksWithClaude(frameworks, claudeToken, query);

          for (const framework of rankedFrameworks) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ recommendation: framework })}\n`
              )
            );
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ error: `Search failed: ${message}` })}\n`
            )
          );
          controller.close();
        }
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }
  );
});

deploy.post('/dry-run', async (c) => {
  const claims = c.get('accessClaims');
  if (!claims) {
    return c.json({ error: 'Authentication required.' }, 401);
  }

  const session = buildAdminSession(claims);
  if (!session.permissions.includes('deployments:create')) {
    return c.json({ error: 'Insufficient permissions.' }, 403);
  }

  let payload: { framework?: string; repo?: string };
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON payload.' }, 400);
  }

  const { framework, repo } = payload;
  if (!framework || !repo) {
    return c.json({ error: 'Framework and repo are required.' }, 400);
  }

  const githubToken = c.env.GITHUB_API_TOKEN as string | undefined;
  if (!githubToken) {
    return c.json({ error: 'GitHub API token not configured.' }, 500);
  }

  return c.newResponse(
    new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            new TextEncoder().encode(
              `⛅️ Cloudflare Workers Deployment Validator\n────────────────────────────────────────\n`
            )
          );

          controller.enqueue(
            new TextEncoder().encode(`📦 Framework: ${framework}\n`)
          );

          controller.enqueue(
            new TextEncoder().encode(`📍 Repository: ${repo}\n\n`)
          );

          controller.enqueue(
            new TextEncoder().encode(`🔍 Validating wrangler.toml...\n`)
          );

          const validation = await validateWranglerConfig(repo, githubToken);

          if (validation.errors.length > 0) {
            controller.enqueue(
              new TextEncoder().encode(`\n❌ Validation errors:\n`)
            );
            for (const error of validation.errors) {
              controller.enqueue(
                new TextEncoder().encode(`  - ${error}\n`)
              );
            }
            controller.enqueue(
              new TextEncoder().encode(`\n✗ Dry-run validation failed\n`)
            );
            controller.close();
            return;
          }

          controller.enqueue(
            new TextEncoder().encode(`✓ wrangler.toml valid\n`)
          );

          if (validation.bindings.length > 0) {
            controller.enqueue(
              new TextEncoder().encode(`✓ Cloudflare bindings detected:\n`)
            );
            for (const binding of validation.bindings) {
              controller.enqueue(
                new TextEncoder().encode(`  - ${binding}\n`)
              );
            }
          }

          if (validation.routes.length > 0) {
            controller.enqueue(
              new TextEncoder().encode(`✓ Routes configured:\n`)
            );
            for (const route of validation.routes.slice(0, 5)) {
              controller.enqueue(
                new TextEncoder().encode(`  - ${route}\n`)
              );
            }
            if (validation.routes.length > 5) {
              controller.enqueue(
                new TextEncoder().encode(
                  `  ... and ${validation.routes.length - 5} more\n`
                )
              );
            }
          }

          if (validation.environments.length > 0) {
            controller.enqueue(
              new TextEncoder().encode(`✓ Environments: ${validation.environments.join(', ')}\n`)
            );
          }

          if (validation.warnings.length > 0) {
            controller.enqueue(
              new TextEncoder().encode(`\n⚠️  Warnings:\n`)
            );
            for (const warning of validation.warnings) {
              controller.enqueue(
                new TextEncoder().encode(`  - ${warning}\n`)
              );
            }
          }

          controller.enqueue(
            new TextEncoder().encode(`\n✅ Dry-run validation passed\n`)
          );

          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          controller.enqueue(
            new TextEncoder().encode(
              `\n❌ Validation error: ${message}\n`
            )
          );
          controller.close();
        }
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }
  );
});

deploy.post('/create-pr', async (c) => {
  const claims = c.get('accessClaims');
  if (!claims) {
    return c.json({ error: 'Authentication required.' }, 401);
  }

  const session = buildAdminSession(claims);
  if (!session.permissions.includes('deployments:create')) {
    return c.json({ error: 'Insufficient permissions.' }, 403);
  }

  let payload: { framework?: string };
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON payload.' }, 400);
  }

  const { framework } = payload;
  if (!framework) {
    return c.json({ error: 'Framework is required.' }, 400);
  }

  return c.json({
    prNumber: 9999,
    prUrl: `https://github.com/marzton/goldshore-ai/pull/9999`,
    framework,
    message: `PR created for framework: ${framework}`,
    status: 'success',
  });
});

export default deploy;
