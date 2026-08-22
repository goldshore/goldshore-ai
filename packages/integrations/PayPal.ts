import { BaseIntegration, IntegrationConfig } from './BaseIntegration';

export interface PayPalTransaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: string;
  payerEmail?: string;
  description?: string;
}

export interface PayPalMetrics {
  totalRevenue: number;
  successfulTransactions: number;
  failedTransactions: number;
  refundedAmount: number;
  averageOrderValue: number;
}

/**
 * PayPal REST API integration (Orders v2 + Reporting/Transaction Search).
 * Config: apiKey = Client ID, apiSecret = Client Secret. Uses the
 * client_credentials grant to obtain a short-lived bearer token, same
 * two-legged pattern PayPal's own SDKs use for server-to-server calls.
 */
export class PayPalIntegration extends BaseIntegration {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(config: IntegrationConfig) {
    super(config);
    this.clientId = config.apiKey || '';
    this.clientSecret = config.apiSecret || '';
  }

  private get apiBase(): string {
    return this.config.metadata?.sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  }

  /**
   * Obtain (and cache) an OAuth bearer token via client_credentials.
   */
  private async getAccessToken(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const creds = btoa(`${this.clientId}:${this.clientSecret}`);
      const response = await fetch(`${this.apiBase}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) return null;

      const data = await response.json() as { access_token: string; expires_in: number };
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
      return this.accessToken;
    } catch (error) {
      console.error('Error obtaining PayPal access token:', error);
      return null;
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      this.config.status = token ? 'connected' : 'disconnected';
      return !!token;
    } catch (error) {
      this.config.status = 'error';
      this.config.error = String(error);
      return false;
    }
  }

  /**
   * Search transactions for a date range via the Transaction Search API.
   * Requires the `Transaction Search` product to be enabled on the app.
   */
  async getTransactions(startDate: string, endDate: string): Promise<PayPalTransaction[]> {
    const token = await this.getAccessToken();
    if (!token) return [];

    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        fields: 'transaction_info,payer_info',
      });

      const response = await fetch(`${this.apiBase}/v1/reporting/transactions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch PayPal transactions');

      const data = await response.json() as any;
      const details = data.transaction_details || [];

      return details.map((d: any) => ({
        id: d.transaction_info?.transaction_id,
        amount: parseFloat(d.transaction_info?.transaction_amount?.value ?? '0'),
        currency: d.transaction_info?.transaction_amount?.currency_code ?? 'USD',
        status: d.transaction_info?.transaction_status ?? 'UNKNOWN',
        created: d.transaction_info?.transaction_initiation_date,
        payerEmail: d.payer_info?.email_address,
        description: d.transaction_info?.transaction_subject,
      }));
    } catch (error) {
      console.error('Error fetching PayPal transactions:', error);
      return [];
    }
  }

  /**
   * Calculate revenue metrics from the last 30 days of transactions.
   */
  async calculateMetrics(): Promise<PayPalMetrics> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const transactions = await this.getTransactions(thirtyDaysAgo.toISOString(), now.toISOString());

      const successful = transactions.filter((t) => t.status === 'S' || t.status === 'COMPLETED');
      const failed = transactions.filter((t) => t.status === 'D' || t.status === 'DENIED' || t.status === 'FAILED');
      const refunded = transactions.filter((t) => t.status === 'R' || t.status === 'REFUNDED');

      const totalRevenue = successful.reduce((sum, t) => sum + t.amount, 0);
      const refundedAmount = refunded.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      return {
        totalRevenue,
        successfulTransactions: successful.length,
        failedTransactions: failed.length,
        refundedAmount,
        averageOrderValue: successful.length > 0 ? totalRevenue / successful.length : 0,
      };
    } catch (error) {
      console.error('Error calculating PayPal metrics:', error);
      return {
        totalRevenue: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        refundedAmount: 0,
        averageOrderValue: 0,
      };
    }
  }

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
   * Handle PayPal webhook events. Full signature verification requires
   * calling PayPal's /v1/notifications/verify-webhook-signature endpoint
   * with the webhook ID — left to the caller (needs a live webhookSecret).
   */
  async handleWebhook(event: Record<string, unknown>): Promise<void> {
    const eventType = event.event_type as string;

    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED':
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.REFUNDED':
      case 'CHECKOUT.ORDER.APPROVED':
        await this.logEvent(eventType, event, {} as any);
        break;
    }
  }
}
