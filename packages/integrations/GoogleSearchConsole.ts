import { BaseIntegration, IntegrationConfig } from './BaseIntegration';

export interface SearchConsoleMetrics {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number; // Click-through rate
  position: number; // Average position
}

export interface SearchQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  country?: string;
  device?: string;
}

export interface CrawlIssue {
  type: 'ERROR' | 'WARNING';
  severity: 'CRITICAL' | 'WARNING';
  count: number;
  samples: string[];
}

export class GoogleSearchConsoleIntegration extends BaseIntegration {
  private siteUrl: string;
  private accessToken: string;
  private refreshToken: string;

  constructor(config: IntegrationConfig) {
    super(config);
    this.siteUrl = config.apiKey || '';
    this.accessToken = config.apiSecret || '';
    this.refreshToken = process.env.GOOGLE_GSC_REFRESH_TOKEN || '';
  }

  async authenticate(): Promise<boolean> {
    try {
      await this.refreshAccessToken();

      const response = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.siteUrl)}`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
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
   * Get search analytics - top performing queries
   */
  async getTopQueries(
    startDate: string,
    endDate: string,
    limit: number = 25
  ): Promise<SearchQuery[]> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.siteUrl)}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startDate,
            endDate,
            dimensions: ['query'],
            rowLimit: limit,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to fetch queries');

      const data = await response.json();
      return (data.rows || []).map((row: Record<string, unknown>) => ({
        query: row.keys?.[0] || '',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: (row.ctr || 0) * 100,
        position: row.position || 0,
      }));
    } catch (error) {
      console.error('Error fetching top queries:', error);
      return [];
    }
  }

  /**
   * Get performance metrics over time
   */
  async getPerformanceMetrics(
    startDate: string,
    endDate: string
  ): Promise<SearchConsoleMetrics[]> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.siteUrl)}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startDate,
            endDate,
            dimensions: ['date'],
            rowLimit: 90,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to fetch metrics');

      const data = await response.json();
      return (data.rows || []).map((row: Record<string, unknown>) => ({
        date: row.keys?.[0] || '',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: (row.ctr || 0) * 100,
        position: row.position || 0,
      }));
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      return [];
    }
  }

  /**
   * Get crawl statistics and issues
   */
  async getCrawlStats(): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.siteUrl)}/crawlStats`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch crawl stats');

      return await response.json();
    } catch (error) {
      console.error('Error fetching crawl stats:', error);
      return {};
    }
  }

  /**
   * Get indexing coverage issues
   */
  async getIndexingIssues(): Promise<CrawlIssue[]> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.siteUrl)}/urlInspection`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch indexing issues');

      const data = await response.json();
      return (data.issues || []).map((issue: Record<string, unknown>) => ({
        type: issue.issueType,
        severity: issue.severity,
        count: issue.issues?.length || 0,
        samples: issue.issues?.slice(0, 3).map((i: Record<string, unknown>) => i.url) || [],
      }));
    } catch (error) {
      console.error('Error fetching indexing issues:', error);
      return [];
    }
  }

  /**
   * Sync Search Console data
   */
  async sync(): Promise<Record<string, unknown>> {
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const startDate = thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      const [topQueries, metrics, crawlStats, issues] = await Promise.all([
        this.getTopQueries(startDate, endDate),
        this.getPerformanceMetrics(startDate, endDate),
        this.getCrawlStats(),
        this.getIndexingIssues(),
      ]);

      const totalClicks = metrics.reduce((sum, m) => sum + m.clicks, 0);
      const totalImpressions = metrics.reduce((sum, m) => sum + m.impressions, 0);
      const avgPosition = metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.position, 0) / metrics.length
        : 0;

      this.config.lastSync = new Date().toISOString();
      this.config.status = 'connected';

      return {
        siteUrl: this.siteUrl,
        summary: {
          totalClicks,
          totalImpressions,
          avgPosition,
          avgCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          criticalIssues: issues.filter((i) => i.severity === 'CRITICAL').length,
        },
        topQueries,
        metrics: metrics.slice(-7), // Last 7 days
        issues,
        lastSync: this.config.lastSync,
      };
    } catch (error) {
      this.config.status = 'error';
      this.config.error = String(error);
      return { error: String(error) };
    }
  }

  async handleWebhook(event: Record<string, unknown>): Promise<void> {
    // Search Console uses API polling, not webhooks
    await this.logEvent('gsc_sync', event, {} as any);
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
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const data = await response.json();
      if (data.access_token) {
        this.accessToken = data.access_token;
      }
    } catch (error) {
      console.error('Error refreshing GSC token:', error);
    }
  }
}
