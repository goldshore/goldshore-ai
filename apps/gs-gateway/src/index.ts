import { Hono } from 'hono';
import { authMiddleware, validateAudienceSecretExists, type AuthMiddlewareEnv } from './middleware/auth';

type GatewayEnv = AuthMiddlewareEnv & {
  API_SERVICE?: Fetcher;
  AGENT_SERVICE?: Fetcher;
  SECURITY_CHECK?: Fetcher;
};

const app = new Hono<{ Bindings: GatewayEnv }>();

async function runSecurityCheck(c: Parameters<Parameters<typeof app.use>[1]>[0]): Promise<Response | null> {
  if (!c.env.SECURITY_CHECK) return null;
  try {
    const response = await c.env.SECURITY_CHECK.fetch(c.req.raw.clone());
    if (response.ok) return null;
    return c.json({ error: 'Request blocked', policy: 'fail-closed' }, response.status as never);
  } catch {
    if (c.req.path === '/signals') return null;
    return c.json({ error: 'Security check unavailable', policy: 'fail-closed' }, 503);
  }
}

function selectUpstream(url: URL, env: GatewayEnv): Fetcher | undefined {
  if (url.hostname === 'agent.goldshore.ai' || url.pathname.startsWith('/agent')) {
    return env.AGENT_SERVICE ?? env.API_SERVICE;
  }
  return env.API_SERVICE;
}

app.use('*', async (c, next) => {
  if (!validateAudienceSecretExists(c.env)) {
    return c.json({ error: 'Gateway misconfigured' }, 503);
  }
  const securityResponse = await runSecurityCheck(c);
  if (securityResponse) return securityResponse;
  return next();
});

app.use('*', authMiddleware);

app.all('*', async (c) => {
  const url = new URL(c.req.url);
  const upstream = selectUpstream(url, c.env);
  if (!upstream) {
    return c.json({ error: 'Gateway upstream unavailable' }, 503);
  }
  return upstream.fetch(c.req.raw);
});

export default app;
