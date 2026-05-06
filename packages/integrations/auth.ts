export type AuthTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type?: string;
  refresh_token?: string;
};

export type AuthTokenConfig = {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  audience?: string;
  refreshSkewMs?: number;
  fetchFn?: typeof fetch;
  logger?: Pick<Console, 'info' | 'warn' | 'error'>;
};

type StoredToken = {
  value: string;
  expiresAt: number;
  refreshToken?: string;
};

const DEFAULT_REFRESH_SKEW_MS = 30_000;

export const createAuthTokenManager = (config: AuthTokenConfig) => {
  const fetchFn = config.fetchFn ?? fetch;
  const logger = config.logger ?? console;
  const refreshSkewMs = config.refreshSkewMs ?? DEFAULT_REFRESH_SKEW_MS;
  let storedToken: StoredToken | null = null;

  const buildTokenRequest = (grantType: string, params: Record<string, string | undefined>) => {
    const body = new URLSearchParams({
      grant_type: grantType,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...params
    });

    return fetchFn(config.tokenUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body
    });
  };

  const requestNewToken = async () => {
    const response = await buildTokenRequest('client_credentials', {
      scope: config.scope,
      audience: config.audience
    });

    if (!response.ok) {
      logger.error('[auth] token request failed', { status: response.status });
      throw new Error(`Token request failed (${response.status})`);
    }

    return (await response.json()) as AuthTokenResponse;
  };

  const requestRefreshToken = async (refreshToken: string) => {
    const response = await buildTokenRequest('refresh_token', { refresh_token: refreshToken });

    if (!response.ok) {
      logger.warn('[auth] refresh token failed, falling back to new token', { status: response.status });
      return null;
    }

    return (await response.json()) as AuthTokenResponse;
  };

  const storeToken = (token: AuthTokenResponse) => {
    const expiresAt = Date.now() + token.expires_in * 1000;
    storedToken = {
      value: token.access_token,
      expiresAt,
      refreshToken: token.refresh_token
    };
  };

  const getToken = async () => {
    if (storedToken && storedToken.expiresAt - refreshSkewMs > Date.now()) {
      return storedToken.value;
    }

    if (storedToken?.refreshToken) {
      const refreshed = await requestRefreshToken(storedToken.refreshToken);
      if (refreshed) {
        storeToken(refreshed);
        return storedToken.value;
      }
    }

    const newToken = await requestNewToken();
    storeToken(newToken);
    return storedToken.value;
  };

  return { getToken };
};
