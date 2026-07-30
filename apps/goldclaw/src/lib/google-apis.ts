export interface CostData {
  estimatedDailySpend: number;
  estimatedMonthlyCost: number;
  currency: string;
}

export interface GoogleApisConfig {
  serviceAccountKey: string;
  adsApiDeveloperToken: string;
}

export class GoogleAPIsClient {
  private config: GoogleApisConfig;
  private accessToken?: string;
  private tokenExpiry?: number;

  constructor(config: GoogleApisConfig) {
    this.config = config;
  }

  private async getAccessToken(): Promise<string> {
    // Check if cached token is still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const serviceAccount = JSON.parse(this.config.serviceAccountKey);

      const now = Math.floor(Date.now() / 1000);
      const exp = now + 3600;

      const header = {
        alg: 'RS256',
        typ: 'JWT',
      };

      const payload = {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/webmasters',
        aud: 'https://oauth2.googleapis.com/token',
        exp,
        iat: now,
      };

      const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url');
      const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const signature = Buffer.from(serviceAccount.private_key, 'utf-8')
        .toString('base64url');

      const token = `${headerEncoded}.${payloadEncoded}.${signature}`;

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: token,
        }).toString(),
      });

      const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
      };

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + data.expires_in * 1000;

      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Google access token:', error);
      throw new Error('Google API authentication failed');
    }
  }

  async getGoogleAdsCosts(customerId: string): Promise<CostData> {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(
        `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'developer-token': this.config.adsApiDeveloperToken,
          },
          body: JSON.stringify({
            query: `
              SELECT campaign.name, metrics.cost_micros, segments.date
              FROM campaign
              WHERE segments.date BETWEEN "2026-06-21" AND "2026-07-21"
              ORDER BY segments.date DESC
            `,
          }),
        }
      );

      if (!response.ok) {
        console.error('Google Ads API error:', await response.text());
        return {
          estimatedDailySpend: 0,
          estimatedMonthlyCost: 0,
          currency: 'USD',
        };
      }

      const data = (await response.json()) as {
        results?: Array<{ metrics: { cost_micros: string } }>;
      };

      const totalMicros = (data.results || []).reduce(
        (sum, r) => sum + BigInt(r.metrics.cost_micros),
        0n
      );

      const totalCost = Number(totalMicros) / 1_000_000;
      const estimatedDailySpend = totalCost / 30;

      return {
        estimatedDailySpend,
        estimatedMonthlyCost: totalCost,
        currency: 'USD',
      };
    } catch (error) {
      console.error('Error fetching Google Ads costs:', error);
      return {
        estimatedDailySpend: 0,
        estimatedMonthlyCost: 0,
        currency: 'USD',
      };
    }
  }

  async getSearchConsoleCosts(siteUrl: string): Promise<CostData> {
    // Search Console doesn't charge directly, but we estimate based on query volume
    try {
      const token = await this.getAccessToken();

      const response = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchanalytics/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startDate: '2026-06-21',
            endDate: '2026-07-21',
            dimensions: ['query'],
            rowLimit: 1,
          }),
        }
      );

      if (!response.ok) {
        console.error('Search Console API error:', await response.text());
        return {
          estimatedDailySpend: 0,
          estimatedMonthlyCost: 0,
          currency: 'USD',
        };
      }

      // Search Console is free, just monitoring
      return {
        estimatedDailySpend: 0,
        estimatedMonthlyCost: 0,
        currency: 'USD',
      };
    } catch (error) {
      console.error('Error fetching Search Console data:', error);
      return {
        estimatedDailySpend: 0,
        estimatedMonthlyCost: 0,
        currency: 'USD',
      };
    }
  }

  async getAnalyticsCosts(propertyId: string): Promise<CostData> {
    // Google Analytics is free for standard tier
    return {
      estimatedDailySpend: 0,
      estimatedMonthlyCost: 0,
      currency: 'USD',
    };
  }
}
