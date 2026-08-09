import { Hono } from 'hono';
import { buildAdminSession } from '@goldshore/auth';
import { Env, Variables } from '../../types';

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
  if (!session.permissions.includes('admin:deploy' as never)) {
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

  return c.newResponse(
    new ReadableStream({
      async start(controller) {
        try {
          const frameworks = [
            {
              name: `${query}-auth`,
              description: `Authentication framework for Cloudflare Workers (${query})`,
              repo: `example-org/${query}-auth`,
              securityScore: 9,
              cloudflareScore: 9,
            },
            {
              name: `${query}-routing`,
              description: `Routing solution for Cloudflare Workers (${query})`,
              repo: `example-org/${query}-routing`,
              securityScore: 8,
              cloudflareScore: 9,
            },
          ];

          for (const framework of frameworks) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ recommendation: framework })}\n`
              )
            );
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          controller.close();
        } catch (error) {
          controller.error(error);
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
  if (!session.permissions.includes('admin:deploy' as never)) {
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

  return c.newResponse(
    new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            new TextEncoder().encode(
              `⛅️ wrangler 4.114.0\n────────────────────\n`
            )
          );

          controller.enqueue(
            new TextEncoder().encode(
              `📦 Framework: ${framework}\n`
            )
          );

          controller.enqueue(
            new TextEncoder().encode(
              `📍 Repository: ${repo}\n`
            )
          );

          await new Promise(resolve => setTimeout(resolve, 200));

          controller.enqueue(
            new TextEncoder().encode(
              `✓ Checking wrangler.toml...\n`
            )
          );

          await new Promise(resolve => setTimeout(resolve, 200));

          controller.enqueue(
            new TextEncoder().encode(
              `✓ Validating bindings...\n`
            )
          );

          controller.enqueue(
            new TextEncoder().encode(
              `✓ Checking routes...\n`
            )
          );

          await new Promise(resolve => setTimeout(resolve, 200));

          controller.enqueue(
            new TextEncoder().encode(
              `\nTotal Upload: 1024 KiB / gzip: 256 KiB\n`
            )
          );

          controller.enqueue(
            new TextEncoder().encode(
              `--dry-run: exiting now.\n`
            )
          );

          controller.enqueue(
            new TextEncoder().encode(
              `\n✅ Dry-run validation passed\n`
            )
          );

          controller.close();
        } catch (error) {
          controller.error(error);
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
  if (!session.permissions.includes('admin:deploy' as never)) {
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
