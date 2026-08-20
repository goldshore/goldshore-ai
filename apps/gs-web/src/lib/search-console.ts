export type SearchConsoleConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  siteUrl: string;
};

export type SearchConsoleMetrics = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsoleQuery = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export const getSearchConsoleConfig = (env: Env | undefined): SearchConsoleConfig | null => {
  const clientId = env?.GOOGLE_GSC_CLIENT_ID || '';
  const clientSecret = env?.GOOGLE_GSC_CLIENT_SECRET || '';
  const refreshToken = env?.GOOGLE_GSC_REFRESH_TOKEN || '';
  const siteUrl = env?.GOOGLE_GSC_SITE_URL || '';

  if (!clientId || !clientSecret || !refreshToken || !siteUrl) {
    return null;
  }

  return { clientId, clientSecret, refreshToken, siteUrl };
};

export const getSearchConsoleAccessToken = async (config: SearchConsoleConfig): Promise<string | null> => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { access_token?: string };
  return data.access_token ?? null;
};

const querySearchAnalytics = async (
  config: SearchConsoleConfig,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{ rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> } | null> => {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) return null;
  return (await response.json()) as {
    rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }>;
  };
};

export const fetchTopQueries = async (
  config: SearchConsoleConfig,
  accessToken: string,
  options?: { startDate?: string; endDate?: string; limit?: number },
): Promise<SearchConsoleQuery[] | null> => {
  const startDate = options?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = options?.endDate || new Date().toISOString().split('T')[0];

  const data = await querySearchAnalytics(config, accessToken, {
    startDate,
    endDate,
    dimensions: ['query'],
    rowLimit: options?.limit ?? 25,
  });
  if (!data) return null;

  return (data.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: (row.ctr ?? 0) * 100,
    position: row.position ?? 0,
  }));
};

export const fetchPerformanceMetrics = async (
  config: SearchConsoleConfig,
  accessToken: string,
  options?: { startDate?: string; endDate?: string },
): Promise<SearchConsoleMetrics[] | null> => {
  const startDate = options?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = options?.endDate || new Date().toISOString().split('T')[0];

  const data = await querySearchAnalytics(config, accessToken, {
    startDate,
    endDate,
    dimensions: ['date'],
    rowLimit: 90,
  });
  if (!data) return null;

  return (data.rows ?? []).map((row) => ({
    date: row.keys?.[0] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: (row.ctr ?? 0) * 100,
    position: row.position ?? 0,
  }));
};
