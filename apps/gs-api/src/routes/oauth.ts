/**
 * OAuth Integration Routes
 * Handles OAuth flows for third-party providers
 * Supports Google, Meta, and other OAuth 2.0 providers
 */

import { Hono } from 'hono';
import { getActor, logAdminAction, requirePermission } from '../auth';
import type { Env, Variables } from '../types';
import { storeSecret } from '../lib/secrets';

const oauth = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * OAuth Provider Configuration
 */
const oauthProviders: Record<string, {
  client_id_env: string;
  client_secret_env: string;
  authorize_url: string;
  token_url: string;
  scope: string[];
}> = {
  google: {
    client_id_env: 'GOOGLE_OAUTH_CLIENT_ID',
    client_secret_env: 'GOOGLE_OAUTH_CLIENT_SECRET',
    authorize_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    scope: [
      'https://www.googleapis.com/auth/adwords',
      'https://www.googleapis.com/auth/webmasters',
    ],
  },
  meta: {
    client_id_env: 'META_APP_ID',
    client_secret_env: 'META_APP_SECRET',
    authorize_url: 'https://www.facebook.com/v18.0/dialog/oauth',
    token_url: 'https://graph.instagram.com/v18.0/oauth/access_token',
    scope: ['instagram_basic', 'instagram_content_publish'],
  },
};

/**
 * GET /oauth/authorize/:provider
 * Initiate OAuth flow for a provider
 * Query: redirect_uri, integration_id, state
 */
oauth.get('/authorize/:provider', async (c) => {
  try {
    const provider = c.req.param('provider').toLowerCase();
    const redirectUri = c.req.query('redirect_uri');
    const integrationId = c.req.query('integration_id');
    const state = c.req.query('state') || crypto.randomUUID();

    if (!provider || !redirectUri || !integrationId) {
      return c.json(
        { error: 'Missing required parameters: provider, redirect_uri, integration_id' },
        400
      );
    }

    const providerConfig = oauthProviders[provider];
    if (!providerConfig) {
      return c.json({ error: `Unsupported OAuth provider: ${provider}` }, 400);
    }

    const clientId = c.env[providerConfig.client_id_env as keyof Env];
    if (!clientId) {
      return c.json({ error: `OAuth client not configured for ${provider}` }, 503);
    }

    // Store state in KV for verification in callback
    await c.env.KV.put(
      `oauth:state:${state}`,
      JSON.stringify({
        provider,
        redirect_uri: redirectUri,
        integration_id: integrationId,
        created_at: new Date().toISOString(),
      }),
      { expirationTtl: 600 } // 10 minute expiry
    );

    // Build authorization URL
    const authUrl = new URL(providerConfig.authorize_url);
    authUrl.searchParams.set('client_id', String(clientId));
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', providerConfig.scope.join(' '));

    if (provider === 'google') {
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
    }

    return c.json({
      success: true,
      data: {
        auth_url: authUrl.toString(),
        state,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('OAuth authorize error:', error);
    return c.json({ error: errorMsg }, 500);
  }
});

/**
 * POST /oauth/callback/:provider
 * Handle OAuth callback from provider
 * Body: { code, state, integration_id }
 */
oauth.post('/callback/:provider', requirePermission('system:integrations:manage'), async (c) => {
  try {
    const provider = c.req.param('provider').toLowerCase();
    const body = await c.req.json<{
      code: string;
      state: string;
      integration_id: string;
    }>();

    if (!provider || !body.code || !body.state || !body.integration_id) {
      return c.json(
        { error: 'Missing required fields: code, state, integration_id' },
        400
      );
    }

    const providerConfig = oauthProviders[provider];
    if (!providerConfig) {
      return c.json({ error: `Unsupported OAuth provider: ${provider}` }, 400);
    }

    // Verify state
    const stateData = await c.env.KV.get(`oauth:state:${body.state}`);
    if (!stateData) {
      return c.json({ error: 'Invalid or expired state parameter' }, 401);
    }

    const statePayload = JSON.parse(stateData);
    if (statePayload.integration_id !== body.integration_id) {
      return c.json({ error: 'Integration ID mismatch' }, 401);
    }

    // Exchange code for token
    const clientId = c.env[providerConfig.client_id_env as keyof Env];
    const clientSecret = c.env[providerConfig.client_secret_env as keyof Env];

    if (!clientId || !clientSecret) {
      return c.json({ error: 'OAuth client not configured' }, 503);
    }

    const tokenResponse = await fetch(providerConfig.token_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: body.code,
        client_id: String(clientId),
        client_secret: String(clientSecret),
        redirect_uri: statePayload.redirect_uri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return c.json({ error: 'Failed to exchange code for token' }, 400);
    }

    const tokenData = await tokenResponse.json<any>();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    if (!accessToken) {
      return c.json({ error: 'No access token in response' }, 400);
    }

    // Store token as secret
    const actor = getActor(c.get('accessClaims'), c.req.raw);
    const result = await storeSecret(c.env, {
      integration_id: body.integration_id,
      key_type: 'oauth_token',
      value: accessToken,
      metadata: {
        provider,
        refresh_token: refreshToken,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
      },
      expires_at: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : undefined,
    }, actor);

    // Log token acquisition
    await logAdminAction(c.env, {
      action: 'oauth.token_acquired',
      actor,
      status: 'success',
      metadata: {
        provider,
        integration_id: body.integration_id,
        secret_id: result.id,
      },
    });

    // Clean up state
    await c.env.KV.delete(`oauth:state:${body.state}`);

    return c.json({
      success: true,
      data: {
        secret_id: result.id,
        integration_id: body.integration_id,
        provider,
        created_at: result.created_at,
        expires_at: result.expires_at,
      },
    }, 201);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('OAuth callback error:', error);

    const body = await c.req.json<any>().catch(() => ({}));
    await logAdminAction(c.env, {
      action: 'oauth.token_acquired',
      actor: getActor(c.get('accessClaims'), c.req.raw),
      status: 'error',
      metadata: { error: errorMsg, integration_id: body?.integration_id },
    });

    return c.json({ error: errorMsg }, 500);
  }
});

/**
 * GET /oauth/providers
 * List available OAuth providers
 */
oauth.get('/providers', (c) => {
  const providers = Object.keys(oauthProviders).map((provider) => ({
    name: provider,
    scope: oauthProviders[provider].scope,
  }));

  return c.json({
    success: true,
    data: providers,
  });
});

export default oauth;
