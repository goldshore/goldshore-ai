import { BaseIntegration, IntegrationConfig } from './BaseIntegration';

export interface GoogleAdsMetrics {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  cpc: number; // Cost per click
  ctr: number; // Click-through rate
  conversionRate: number;
  roas: number; // Return on ad spend
}

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  type: string;
  budgetAmount: number;
  startDate?: string;
  endDate?: string;
  metrics: GoogleAdsMetrics;
}

export class GoogleAdsIntegration extends BaseIntegration {
  private customerId: string;
  private accessToken: string;
  private refreshToken: string;
  private clientId: string;
  private clientSecret: string;

  constructor(config: IntegrationConfig) {
    super(config);
    const [customerId, clientId, clientSecret] = config.apiKey.split(':');
    this.customerId = customerId || '';
    this.clientId = clientId || '';
    this.clientSecret = clientSecret || '';
    this.accessToken = config.apiSecret || '';
    this.refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN || '';
  }

  async authenticate(): Promise<boolean> {
    try {
      // Refresh access token if needed
      await this.refreshAccessToken();

      const response = await fetch(
        `https://googleads.googleapis.com/v15/customers/${this.customerId}:searchStream`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
          },
          body: JSON.stringify({
            query: 'SELECT customer.id LIMIT 1',
          }),
        }
      );

      this.config.status = response.ok ? 'connected' : 'disconnected';
      return response.ok;
    } catch (error) {
      this.config.status = 'error';
      this.config.error = String(error);
      return false;
    }
  }

  /**
   * Get Google Ads campaigns
   */
  async getCampaigns(): Promise<GoogleAdsCampaign[]> {
    try {
      const response = await fetch(
        `https://googleads.googleapis.com/v15/customers/${this.customerId}:searchStream`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
          },
          body: JSON.stringify({
            query: `
              SELECT campaign.id, campaign.name, campaign.status, campaign.type
              FROM campaign
              WHERE campaign.status != REMOVED
              ORDER BY campaign.id DESC
              LIMIT 100
            `,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to fetch campaigns');

      const text = await response.text();
      const lines = text.split('\n').filter((l) => l.trim());
      const campaigns: GoogleAdsCampaign[] = [];

      for (const line of lines) {
        if (line.startsWith('{')) {
          const data = JSON.parse(line);
          const campaign = data.results?.[0]?.campaign;
          if (campaign) {
            campaigns.push({
              id: campaign.id,
              name: campaign.name,
              status: campaign.status,
              type: campaign.type,
              budgetAmount: 0, // Fetch from budget separately
              metrics: {} as GoogleAdsMetrics,
            });
          }
        }
      }

      return campaigns;
    } catch (error) {
      console.error('Error fetching Google Ads campaigns:', error);
      return [];
    }
  }

  /**
   * Get campaign metrics for date range
   */
  async getCampaignMetrics(
    campaignId: string,
    startDate: string,
    endDate: string
  ): Promise<GoogleAdsMetrics[]> {
    try {
      const response = await fetch(
        `https://googleads.googleapis.com/v15/customers/${this.customerId}:searchStream`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
          },
          body: JSON.stringify({
            query: `
              SELECT metrics.date, metrics.impressions, metrics.clicks, metrics.cost_micros,
                     metrics.conversions, metrics.cost_per_conversion
              FROM campaign_daily_stats
              WHERE campaign.id = '${campaignId}'
              AND metrics.date BETWEEN '${startDate}' AND '${endDate}'
              ORDER BY metrics.date DESC
            `,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to fetch metrics');

      const text = await response.text();
      const lines = text.split('\n').filter((l) => l.trim());
      const metrics: GoogleAdsMetrics[] = [];

      for (const line of lines) {
        if (line.startsWith('{')) {
          const data = JSON.parse(line);
          const m = data.results?.[0]?.metrics;
          if (m) {
            metrics.push({
              date: m.date,
              impressions: parseInt(m.impressions || 0),
              clicks: parseInt(m.clicks || 0),
              spend: m.cost_micros ? m.cost_micros / 1000000 : 0,
              conversions: parseInt(m.conversions || 0),
              cpc: m.cost_per_conversion ? m.cost_per_conversion / 1000000 : 0,
              ctr:
                m.impressions && m.clicks
                  ? (m.clicks / m.impressions) * 100
                  : 0,
              conversionRate:
                m.clicks && m.conversions
                  ? (m.conversions / m.clicks) * 100
                  : 0,
              roas: 0, // Calculate from revenue data
            });
          }
        }
      }

      return metrics;
    } catch (error) {
      console.error('Error fetching campaign metrics:', error);
      return [];
    }
  }

  /**
   * Sync Google Ads data
   */
  async sync(): Promise<Record<string, unknown>> {
    try {
      const campaigns = await this.getCampaigns();
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch metrics for each campaign
      for (const campaign of campaigns) {
        const metrics = await this.getCampaignMetrics(
          campaign.id,
          thirtyDaysAgo.toISOString().split('T')[0],
          today.toISOString().split('T')[0]
        );
        if (metrics.length > 0) {
          campaign.metrics = metrics[0]; // Most recent
        }
      }

      this.config.lastSync = new Date().toISOString();
      this.config.status = 'connected';

      return {
        customerId: this.customerId,
        campaigns,
        lastSync: this.config.lastSync,
      };
    } catch (error) {
      this.config.status = 'error';
      this.config.error = String(error);
      return { error: String(error) };
    }
  }

  async handleWebhook(event: Record<string, unknown>): Promise<void> {
    // Google Ads doesn't use webhooks; data is pulled via API
    await this.logEvent('ads_sync', event, {} as any);
  }

  /**
   * Refresh OAuth access token
   */
  private async refreshAccessToken(): Promise<void> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const data = await response.json();
      if (data.access_token) {
        this.accessToken = data.access_token;
      }
    } catch (error) {
      console.error('Error refreshing Google Ads token:', error);
    }
  }
}
