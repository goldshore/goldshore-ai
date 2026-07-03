/**
 * Base Integration Class
 * All third-party API integrations extend this
 */

export interface IntegrationConfig {
  name: string;
  type?: string;
  provider: string;
  apiKey: string;
  apiSecret?: string;
  baseUrl?: string;
  webhookSecret?: string;
  metadata?: Record<string, unknown>;
  enabled: boolean;
  lastSync?: string;
  status: 'connected' | 'disconnected' | 'error';
  error?: string;
}

export interface IntegrationEvent {
  id: string;
  integrationName: string;
  eventType: string;
  timestamp: string;
  data: Record<string, unknown>;
  processed: boolean;
}

export abstract class BaseIntegration {
  protected config: IntegrationConfig;
  protected name: string;

  constructor(config: IntegrationConfig) {
    this.config = config;
    this.name = config.name;
  }

  /**
   * Validate API credentials and connection
   */
  abstract authenticate(): Promise<boolean>;

  /**
   * Sync data from external service
   */
  abstract sync(): Promise<Record<string, unknown>>;

  /**
   * Handle webhook events from external service
   */
  abstract handleWebhook(event: Record<string, unknown>): Promise<void>;

  /**
   * Get integration status
   */
  async getStatus(): Promise<IntegrationConfig> {
    return this.config;
  }

  /**
   * Store configuration in KV
   */
  async storeConfig(kv: Record<string, unknown>): Promise<void> {
    if (!kv || typeof (kv as any).put !== 'function') {
      throw new Error('KV storage not available');
    }

    const key = `integration:${this.name}`;
    await (kv as any).put(key, JSON.stringify(this.config), {
      expirationTtl: 365 * 24 * 60 * 60, // 1 year
    });
  }

  /**
   * Retrieve configuration from KV
   */
  static async loadConfig(
    name: string,
    kv: Record<string, unknown>
  ): Promise<IntegrationConfig | null> {
    if (!kv || typeof (kv as any).get !== 'function') {
      return null;
    }

    const key = `integration:${name}`;
    const config = await (kv as any).get(key, 'json');
    return config as IntegrationConfig | null;
  }

  /**
   * Log integration event
   */
  protected async logEvent(
    eventType: string,
    data: Record<string, unknown>,
    kv: Record<string, unknown>
  ): Promise<void> {
    if (!kv || typeof (kv as any).put !== 'function') {
      return;
    }

    const event: IntegrationEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      integrationName: this.name,
      eventType,
      timestamp: new Date().toISOString(),
      data,
      processed: false,
    };

    const key = `event:${this.name}:${event.id}`;
    await (kv as any).put(key, JSON.stringify(event));
  }

  /**
   * Parse webhook signature
   */
  protected verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // Override in subclasses for provider-specific verification
    return true;
  }
}
