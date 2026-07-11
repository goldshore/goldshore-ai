import { BaseIntegration, IntegrationConfig } from './BaseIntegration';

export interface StripeCustomer {
  id: string;
  email: string;
  name?: string;
  created: number;
  metadata?: Record<string, string>;
}

export interface StripeCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  customer?: string;
  description?: string;
}

export interface StripeMetrics {
  totalRevenue: number;
  successfulCharges: number;
  failedCharges: number;
  refundedAmount: number;
  averageOrderValue: number;
  customerCount: number;
  churnRate: number;
}

export class StripeIntegration extends BaseIntegration {
  private apiKey: string;
  private webhookSecret: string;

  constructor(config: IntegrationConfig) {
    super(config);
    this.apiKey = config.apiSecret || '';
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch('https://api.stripe.com/v1/account', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
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
   * Get Stripe customers
   */
  async getCustomers(limit: number = 100): Promise<StripeCustomer[]> {
    try {
      const response = await fetch('https://api.stripe.com/v1/customers', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!response.ok) throw new Error('Failed to fetch customers');

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Stripe customers:', error);
      return [];
    }
  }

  /**
   * Get charges for date range
   */
  async getCharges(startDate: number, endDate: number, limit: number = 100): Promise<StripeCharge[]> {
    try {
      const params = new URLSearchParams({
        'created[gte]': startDate.toString(),
        'created[lte]': endDate.toString(),
        limit: limit.toString(),
      });

      const response = await fetch(`https://api.stripe.com/v1/charges?${params}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!response.ok) throw new Error('Failed to fetch charges');

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Stripe charges:', error);
      return [];
    }
  }

  /**
   * Get refunds for date range
   */
  async getRefunds(startDate: number, endDate: number): Promise<Record<string, unknown>[]> {
    try {
      const params = new URLSearchParams({
        'created[gte]': startDate.toString(),
        'created[lte]': endDate.toString(),
        limit: '100',
      });

      const response = await fetch(`https://api.stripe.com/v1/refunds?${params}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!response.ok) throw new Error('Failed to fetch refunds');

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Stripe refunds:', error);
      return [];
    }
  }

  /**
   * Calculate metrics from charges
   */
  async calculateMetrics(): Promise<StripeMetrics> {
    try {
      const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
      const now = Math.floor(Date.now() / 1000);

      const [charges, refunds, customers] = await Promise.all([
        this.getCharges(thirtyDaysAgo, now, 100),
        this.getRefunds(thirtyDaysAgo, now),
        this.getCustomers(100),
      ]);

      const successfulCharges = charges.filter((c) => c.status === 'succeeded');
      const failedCharges = charges.filter((c) => c.status === 'failed');
      const totalRevenue = successfulCharges.reduce((sum, c) => sum + c.amount, 0) / 100;
      const refundedAmount = refunds.reduce((sum, r: any) => sum + r.amount, 0) / 100;

      return {
        totalRevenue,
        successfulCharges: successfulCharges.length,
        failedCharges: failedCharges.length,
        refundedAmount,
        averageOrderValue:
          successfulCharges.length > 0
            ? successfulCharges.reduce((sum, c) => sum + c.amount, 0) / successfulCharges.length / 100
            : 0,
        customerCount: customers.length,
        churnRate: 0, // Would need historical data
      };
    } catch (error) {
      console.error('Error calculating Stripe metrics:', error);
      return {
        totalRevenue: 0,
        successfulCharges: 0,
        failedCharges: 0,
        refundedAmount: 0,
        averageOrderValue: 0,
        customerCount: 0,
        churnRate: 0,
      };
    }
  }

  /**
   * Sync Stripe data
   */
  async sync(): Promise<Record<string, unknown>> {
    try {
      const metrics = await this.calculateMetrics();

      this.config.lastSync = new Date().toISOString();
      this.config.status = 'connected';

      return {
        metrics,
        lastSync: this.config.lastSync,
      };
    } catch (error) {
      this.config.status = 'error';
      this.config.error = String(error);
      return { error: String(error) };
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Record<string, unknown>): Promise<void> {
    const eventType = event.type as string;

    switch (eventType) {
      case 'charge.succeeded':
      case 'charge.failed':
      case 'customer.created':
      case 'customer.subscription.updated':
        await this.logEvent(eventType, event, {} as any);
        break;
    }
  }
}
