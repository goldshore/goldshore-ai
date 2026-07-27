export type AdSenseConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountId: string;
};

export type AdSenseAccount = {
  name: string;
  displayName: string;
  createTime: string;
};

export type AdSenseReportData = {
  date: string;
  earnings: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  rpm: number;
};

export const getAdSenseConfig = (env: Env | undefined): AdSenseConfig | null => {
  const clientId = env?.GOOGLE_ADSENSE_CLIENT_ID || '';
  const clientSecret = env?.GOOGLE_ADSENSE_CLIENT_SECRET || '';
  const refreshToken = env?.GOOGLE_ADSENSE_REFRESH_TOKEN || '';
  const accountId = env?.GOOGLE_ADSENSE_ACCOUNT_ID || '';

  if (!clientId || !clientSecret || !accountId || !refreshToken) {
    return null;
  }

  return { clientId, clientSecret, refreshToken, accountId };
};

export const getAdSenseAccessToken = async (config: AdSenseConfig): Promise<string | null> => {
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

export const fetchAdSenseAccount = async (
  config: AdSenseConfig,
  accessToken: string,
): Promise<AdSenseAccount | null> => {
  const response = await fetch(`https://adsense.googleapis.com/v2/accounts/${config.accountId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as AdSenseAccount;
  return { name: data.name, displayName: data.displayName, createTime: data.createTime };
};

export const fetchAdSenseReports = async (
  config: AdSenseConfig,
  accessToken: string,
  options?: { startDate?: string; endDate?: string },
): Promise<AdSenseReportData[] | null> => {
  const startDate = options?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = options?.endDate || new Date().toISOString().split('T')[0];

  const response = await fetch(`https://adsense.googleapis.com/v2/accounts/${config.accountId}/reports/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRange: { startDate, endDate },
      metrics: ['EARNINGS', 'IMPRESSIONS', 'CLICKS', 'CTR', 'CPM', 'RPM'],
      dimensions: ['DATE'],
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { rows?: Array<{ cells: Array<{ value: string }> }> };
  if (!data.rows) return [];

  return data.rows.map((row) => ({
    date: row.cells[0]?.value || '',
    earnings: parseFloat(row.cells[1]?.value || '0'),
    impressions: parseInt(row.cells[2]?.value || '0', 10),
    clicks: parseInt(row.cells[3]?.value || '0', 10),
    ctr: parseFloat(row.cells[4]?.value || '0'),
    cpm: parseFloat(row.cells[5]?.value || '0'),
    rpm: parseFloat(row.cells[6]?.value || '0'),
  }));
};
