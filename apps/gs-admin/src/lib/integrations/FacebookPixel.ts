import { BaseIntegration, IntegrationConfig } from './BaseIntegration';

export interface PixelEvent {
  eventId: string;
  eventName: 'Purchase' | 'AddToCart' | 'ViewContent' | 'Lead' | 'CompleteRegistration';
  eventTime: number;
  userData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  customData?: {
    value?: number;
    currency?: string;
    contentName?: string;
    contentType?: string;
    contentId?: string;
  };
}

export interface ConversionAPIEvent {
  pixelId: string;
  event: PixelEvent;
  testEventCode?: string;
}

export class FacebookPixelIntegration extends BaseIntegration {
  private pixelId: string;
  private accessToken: string;

  constructor(config: IntegrationConfig) {
    super(config);
    this.pixelId = config.apiKey.split(':')[0] || '';
    this.accessToken = config.apiSecret || '';
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(
        `https://graph.instagram.com/v18.0/${this.pixelId}?access_token=${this.accessToken}`
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
   * Send event via Conversions API (server-side tracking)
   * More reliable than pixel tracking, works with ad blockers
   */
  async trackEvent(event: PixelEvent, testCode?: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://graph.instagram.com/v18.0/${this.pixelId}/events?access_token=${this.accessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: [
              {
                event_name: event.eventName,
                event_time: event.eventTime,
                event_id: event.eventId,
                user_data: event.userData ? await this.hashUserData(event.userData) : {},
                custom_data: event.customData,
              },
            ],
            ...(testCode && { test_event_code: testCode }),
          }),
        }
      );

      const result = await response.json();
      return (result.events_received || 0) > 0;
    } catch (error) {
      console.error('Facebook Conversions API error:', error);
      return false;
    }
  }

  /**
   * Get pixel insights (impressions, clicks, conversions)
   */
  async getInsights(startDate: string, endDate: string) {
    try {
      const response = await fetch(
        `https://graph.instagram.com/v18.0/${this.pixelId}/insights?` +
        `fields=event_name,event_count,event_value&` +
        `date_start=${startDate}&date_end=${endDate}&` +
        `access_token=${this.accessToken}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch pixel insights');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching pixel insights:', error);
      return [];
    }
  }

  /**
   * Sync pixel data with local database
   */
  async sync(): Promise<Record<string, unknown>> {
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const insights = await this.getInsights(
        sevenDaysAgo.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      );

      this.config.lastSync = new Date().toISOString();
      this.config.status = 'connected';

      return {
        pixelId: this.pixelId,
        events: insights,
        lastSync: this.config.lastSync,
      };
    } catch (error) {
      this.config.status = 'error';
      this.config.error = String(error);
      return { error: String(error) };
    }
  }

  /**
   * Handle webhook events from Facebook
   */
  async handleWebhook(event: Record<string, unknown>): Promise<void> {
    // Verify webhook signature
    const signature = event.header?.['X-Hub-Signature-256'] as string;
    if (!this.verifyWebhookSignature(
      JSON.stringify(event),
      signature,
      this.config.webhookSecret || ''
    )) {
      throw new Error('Invalid webhook signature');
    }

    // Process webhook events
    await this.logEvent('pixel_webhook', event, {} as any);
  }

  /**
   * Hash user data for privacy (SHA-256) before sending to Meta.
   */
  private async hashUserData(userData: Record<string, unknown>): Promise<Record<string, string>> {
    const normalizeText = (value: unknown): string | undefined =>
      typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : undefined;
    const normalizePhone = (value: unknown): string | undefined => {
      if (typeof value !== 'string') return undefined;
      const normalized = value.replace(/[^0-9]/g, '');
      return normalized || undefined;
    };

    const fields: Record<string, string | undefined> = {
      em: normalizeText(userData.email),
      ph: normalizePhone(userData.phone),
      fn: normalizeText(userData.firstName),
      ln: normalizeText(userData.lastName),
      ct: normalizeText(userData.city),
      st: normalizeText(userData.state),
      zp: normalizeText(userData.zipCode),
      country: normalizeText(userData.country),
    };

    const hashedEntries = await Promise.all(
      Object.entries(fields)
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
        .map(async ([key, value]) => [key, await this.sha256(value)] as const)
    );

    return Object.fromEntries(hashedEntries);
  }

  private async sha256(value: string): Promise<string> {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Verify Facebook webhook signature (SHA256)
   */
  protected verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // Implementation would use crypto.subtle.digest('SHA-256', ...)
    // Placeholder for signature verification
    return true;
  }
}
