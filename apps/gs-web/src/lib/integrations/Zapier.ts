import { BaseIntegration, IntegrationConfig } from './BaseIntegration';

export interface ZapierWebhook {
  id: string;
  name: string;
  url: string;
  active: boolean;
  created: number;
}

export interface ZapierZap {
  id: string;
  title: string;
  status: 'on' | 'off';
  lastRun?: number;
  taskCount: number;
  created: number;
}

export class ZapierIntegration extends BaseIntegration {
  private apiKey: string;
  private webhookUrl: string;

  constructor(config: IntegrationConfig) {
    super(config);
    this.apiKey = config.apiSecret || '';
    this.webhookUrl = config.apiKey || '';
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch('https://zapier.com/api/v1/zaps', {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      this.config.status = response.ok ? 'connected' : 'disconnected';
      return response.ok;
    } catch (error) {
      this.config.status = 'error';
      this.config.error = String(error);
      return false;
    }
  }

  /**
   * Get all Zaps (automated workflows)
   */
  async getZaps(): Promise<ZapierZap[]> {
    try {
      const response = await fetch('https://zapier.com/api/v1/zaps', {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch Zaps');

      const data = await response.json();
      return (data.data || []).map((zap: any) => ({
        id: zap.id,
        title: zap.title,
        status: zap.status,
        lastRun: zap.last_run,
        taskCount: zap.task_count || 0,
        created: zap.created,
      }));
    } catch (error) {
      console.error('Error fetching Zaps:', error);
      return [];
    }
  }

  /**
   * Get task history for date range
   */
  async getTaskHistory(startDate: number, endDate: number): Promise<Record<string, unknown>> {
    try {
      const params = new URLSearchParams({
        start_date: new Date(startDate * 1000).toISOString(),
        end_date: new Date(endDate * 1000).toISOString(),
      });

      const response = await fetch(`https://zapier.com/api/v1/tasks?${params}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch task history');

      return await response.json();
    } catch (error) {
      console.error('Error fetching task history:', error);
      return {};
    }
  }

  /**
   * Sync Zapier data
   */
  async sync(): Promise<Record<string, unknown>> {
    try {
      const zaps = await this.getZaps();
      const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
      const now = Math.floor(Date.now() / 1000);
      const taskHistory = await this.getTaskHistory(thirtyDaysAgo, now);

      const activeZaps = zaps.filter((z) => z.status === 'on');

      this.config.lastSync = new Date().toISOString();
      this.config.status = 'connected';

      return {
        zapCount: zaps.length,
        activeZaps: activeZaps.length,
        zaps,
        taskHistory,
        lastSync: this.config.lastSync,
      };
    } catch (error) {
      this.config.status = 'error';
      this.config.error = String(error);
      return { error: String(error) };
    }
  }

  /**
   * Handle incoming webhook from Zapier
   */
  async handleWebhook(event: Record<string, unknown>): Promise<void> {
    await this.logEvent('zapier_webhook', event, {} as any);
  }
}
