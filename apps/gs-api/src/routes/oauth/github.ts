import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import crypto from 'crypto';

export const github = new Hono();

interface GitHubAppEnv {
  Bindings: {
    INTEGRATION_MASTER_KEY: any;
    KV: KVNamespace;
  };
  Variables: {
    userId?: string;
  };
}

// Generate GitHub OAuth URL
github.get('/', async (c) => {
  const appId = c.env.INTEGRATION_MASTER_KEY?.get('GITHUB_APP_CLIENT_ID') || 'Iv1.2fd777cc3eb8c888';
  const redirectUri = c.env.INTEGRATION_MASTER_KEY?.get('GITHUB_OAUTH_REDIRECT_URI') || 'https://goldshore.ai/oauth/github/callback';

  const state = crypto.randomBytes(16).toString('hex');
  const scope = 'repo workflow admin:repo_hook user:email';

  // Store state in KV for validation
  await c.env.KV.put(`oauth:state:${state}`, 'pending', { expirationTtl: 600 });

  // Store redirect_to URL if provided
  const redirectTo = new URL(c.req.url).searchParams.get('redirect_to');
  if (redirectTo) {
    await c.env.KV.put(`oauth:redirect:${state}`, redirectTo, { expirationTtl: 600 });
  }

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('allow_signup', 'true');

  return c.redirect(authUrl.toString());
});

// OAuth callback handler
github.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.json({ error: 'Missing code or state parameter' }, 400);
  }

  // Validate state token
  const stateValidation = await c.env.KV.get(`oauth:state:${state}`);
  if (!stateValidation) {
    return c.json({ error: 'Invalid or expired state token' }, 401);
  }

  try {
    const clientId = c.env.INTEGRATION_MASTER_KEY?.get('GITHUB_APP_CLIENT_ID') || 'Iv1.2fd777cc3eb8c888';
    const clientSecret = c.env.INTEGRATION_MASTER_KEY?.get('GITHUB_APP_CLIENT_SECRET');
    const redirectUri = c.env.INTEGRATION_MASTER_KEY?.get('GITHUB_OAUTH_REDIRECT_URI') || 'https://goldshore.ai/oauth/github/callback';

    if (!clientSecret) {
      throw new Error('GitHub App Client Secret not configured');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json() as any;

    if (tokenData.error) {
      return c.json({ error: tokenData.error_description || tokenData.error }, 401);
    }

    if (!tokenData.access_token) {
      return c.json({ error: 'Failed to obtain access token' }, 500);
    }

    // Fetch user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const user = await userResponse.json() as any;

    // Create session
    const sessionId = crypto.randomUUID();
    const sessionData = {
      userId: user.id,
      login: user.login,
      email: user.email,
      avatar: user.avatar_url,
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type || 'bearer',
      createdAt: new Date().toISOString(),
    };

    // Store session in KV (1 hour TTL)
    await c.env.KV.put(
      `session:github:${sessionId}`,
      JSON.stringify(sessionData),
      { expirationTtl: 3600 }
    );

    // Set secure session cookie
    setCookie(c, 'github_session', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 3600,
      path: '/',
    });

    // Clean up OAuth state
    await c.env.KV.delete(`oauth:state:${state}`);

    // Get redirect URL
    const redirectTo = await c.env.KV.get(`oauth:redirect:${state}`);
    await c.env.KV.delete(`oauth:redirect:${state}`);

    const finalRedirect = redirectTo || '/admin';
    return c.redirect(finalRedirect);

  } catch (error) {
    console.error('OAuth callback error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'OAuth flow failed' },
      500
    );
  }
});

// Get current session
github.get('/session', async (c) => {
  const sessionId = getCookie(c, 'github_session');

  if (!sessionId) {
    return c.json({ authenticated: false }, 401);
  }

  const sessionData = await c.env.KV.get(`session:github:${sessionId}`);

  if (!sessionData) {
    return c.json({ authenticated: false }, 401);
  }

  const session = JSON.parse(sessionData);
  return c.json({
    authenticated: true,
    user: {
      id: session.userId,
      login: session.login,
      email: session.email,
      avatar: session.avatar,
    },
  });
});

// Logout
github.post('/logout', async (c) => {
  const sessionId = getCookie(c, 'github_session');

  if (sessionId) {
    await c.env.KV.delete(`session:github:${sessionId}`);
  }

  deleteCookie(c, 'github_session');
  return c.json({ success: true });
});

export default github;
