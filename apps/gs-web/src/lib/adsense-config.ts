export interface AdSenseConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountId: string;
}

export interface AdSenseAccount {
  name: string;
  displayName: string;
  createTime: string;
}

export interface AdSenseReport {
  rows: Array<{
    cells: Array<{ value: string }>;
  }>;
  totals?: Array<{ value: string }>;
  warnings?: string[];
}

export interface AdSenseReportData {
  date: string;
  earnings: number;
  impressions: number;
  clicks: number;
  ctr: number; // Click-through rate
  cpm: number; // Cost per thousand impressions
  rpm: number; // Revenue per thousand impressions
}

export const getAdSenseConfig = (): AdSenseConfig | null => {
  const clientId = process.env.GOOGLE_ADSENSE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_ADSENSE_CLIENT_SECRET || '';
  const refreshToken = process.env.GOOGLE_ADSENSE_REFRESH_TOKEN || '';
  const accountId = process.env.GOOGLE_ADSENSE_ACCOUNT_ID || '';

  if (!clientId || !clientSecret || !accountId) {
    console.warn('AdSense configuration incomplete');
    return null;
  }

  return { clientId, clientSecret, refreshToken, accountId };
};

export const getAdSenseAccessToken = async (config: AdSenseConfig): Promise<string | null> => {
  try {
    if (!config.refreshToken) {
      console.error('No refresh token available for AdSense');
      return null;
    }

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

    if (!response.ok) {
      console.error('Failed to get AdSense access token');
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting AdSense access token:', error);
    return null;
  }
};

export const fetchAdSenseAccount = async (
  config: AdSenseConfig,
  accessToken: string
): Promise<AdSenseAccount | null> => {
  try {
    const response = await fetch(
      `https://adsense.googleapis.com/v2/accounts/${config.accountId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch AdSense account');
      return null;
    }

    const data = await response.json();
    return {
      name: data.name,
      displayName: data.displayName,
      createTime: data.createTime,
    };
  } catch (error) {
    console.error('Error fetching AdSense account:', error);
    return null;
  }
};

export const fetchAdSenseReports = async (
  config: AdSenseConfig,
  accessToken: string,
  options?: {
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
    metrics?: string[];
    dimensions?: string[];
  }
): Promise<AdSenseReportData[] | null> => {
  try {
    const startDate = options?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = options?.endDate || new Date().toISOString().split('T')[0];
    const metrics = options?.metrics || ['EARNINGS', 'IMPRESSIONS', 'CLICKS', 'CTR', 'CPM', 'RPM'];
    const dimensions = options?.dimensions || ['DATE'];

    const response = await fetch('https://adsense.googleapis.com/v2/accounts/' + config.accountId + '/reports/generate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRange: {
          startDate,
          endDate,
        },
        metrics,
        dimensions,
      }),
    });

    if (!response.ok) {
      console.error('Failed to fetch AdSense reports');
      return null;
    }

    const data: { rows?: Array<{ cells: Array<{ value: string }> }> } = await response.json();
    if (!data.rows || data.rows.length === 0) {
      return [];
    }

    return data.rows.map((row) => ({
      date: row.cells[0]?.value || '',
      earnings: parseFloat(row.cells[1]?.value || '0'),
      impressions: parseInt(row.cells[2]?.value || '0', 10),
      clicks: parseInt(row.cells[3]?.value || '0', 10),
      ctr: parseFloat(row.cells[4]?.value || '0'),
      cpm: parseFloat(row.cells[5]?.value || '0'),
      rpm: parseFloat(row.cells[6]?.value || '0'),
    }));
  } catch (error) {
    console.error('Error fetching AdSense reports:', error);
    return null;
  }
};
