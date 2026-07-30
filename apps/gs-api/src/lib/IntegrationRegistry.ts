/**
 * Integration Registry
 * Centralized management of all third-party integrations
 * Extensible pattern for adding new integrations
 */

import { BaseIntegration, IntegrationConfig } from './BaseIntegration';
import { FacebookPixelIntegration } from './FacebookPixel';
import { WhatsAppBusinessIntegration } from './WhatsAppBusiness';
import { GoogleAdsIntegration } from './GoogleAds';
import { GoogleSearchConsoleIntegration } from './GoogleSearchConsole';
import { StripeIntegration } from './Stripe';
import { ZapierIntegration } from './Zapier';
import { CustomIntegration } from './Custom';

export type IntegrationType = 'facebook_pixel' | 'whatsapp' | 'google_ads' | 'google_gsc' | 'stripe' | 'zapier' | 'custom';

export interface IntegrationDefinition {
  id: string;
  name: string;
  type: IntegrationType;
  description: string;
  icon?: string;
  docUrl?: string;
  requiredFields: string[];
}

export interface IntegrationStatus {
  name: string;
  type: IntegrationType;
  status: string;
  provider?: string;
  lastSync?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export const INTEGRATION_DEFINITIONS: Record<IntegrationType, IntegrationDefinition> = {
  facebook_pixel: {
    id: 'facebook_pixel',
    name: 'Facebook Pixel & Conversions API',
    type: 'facebook_pixel',
    description: 'Track conversions and user actions across web and mobile',
    docUrl: 'https://developers.facebook.com/docs/facebook-pixel',
    requiredFields: ['pixelId', 'accessToken'],
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp Business API',
    type: 'whatsapp',
    description: 'Send messages and manage customer conversations',
    docUrl: 'https://developers.facebook.com/docs/whatsapp',
    requiredFields: ['businessAccountId', 'phoneNumberId', 'accessToken'],
  },
  google_ads: {
    id: 'google_ads',
    name: 'Google Ads (AdWords)',
    type: 'google_ads',
    description: 'Manage campaigns, budgets, and performance metrics',
    docUrl: 'https://developers.google.com/google-ads/api',
    requiredFields: ['customerId', 'accessToken', 'developerToken'],
  },
  google_gsc: {
    id: 'google_gsc',
    name: 'Google Search Console',
    type: 'google_gsc',
    description: 'Monitor search rankings, clicks, impressions, and indexing',
    docUrl: 'https://developers.google.com/webmaster-tools',
    requiredFields: ['siteUrl', 'accessToken'],
  },
  stripe: {
    id: 'stripe',
    name: 'Stripe Payments',
    type: 'stripe',
    description: 'Process payments and manage transactions',
    docUrl: 'https://stripe.com/docs/api',
    requiredFields: ['apiKey', 'apiSecret'],
  },
  zapier: {
    id: 'zapier',
    name: 'Zapier',
    type: 'zapier',
    description: 'Connect 7000+ apps with automated workflows',
    docUrl: 'https://zapier.com/apps',
    requiredFields: ['webhookUrl'],
  },
  custom: {
    id: 'custom',
    name: 'Custom Integration',
    type: 'custom',
    description: 'Build your own custom integration',
    requiredFields: ['apiUrl', 'apiKey'],
  },
};

export class IntegrationRegistry {
  private integrations: Map<string, BaseIntegration>;
  private kv: Record<string, unknown> | undefined;

  constructor(kv?: Record<string, unknown>) {
    this.integrations = new Map();
    this.kv = kv;
  }

  /**
   * Register a new integration
   */
  register(name: string, integration: BaseIntegration): void {
    this.integrations.set(name, integration);
  }

  /**
   * Create and register integration by type
   */
  createIntegration(config: IntegrationConfig & { type: IntegrationType }): BaseIntegration {
    let integration: BaseIntegration;

    switch (config.type) {
      case 'facebook_pixel':
        integration = new FacebookPixelIntegration(config);
        break;
      case 'whatsapp':
        integration = new WhatsAppBusinessIntegration(config);
        break;
      case 'google_ads':
        integration = new GoogleAdsIntegration(config);
        break;
      case 'google_gsc':
        integration = new GoogleSearchConsoleIntegration(config);
        break;
      case 'stripe':
        integration = new StripeIntegration(config);
        break;
      case 'zapier':
        integration = new ZapierIntegration(config);
        break;
      case 'custom':
        integration = new CustomIntegration(config);
        break;
      default:
        throw new Error(`Unsupported integration type: ${config.type}`);
    }

    this.register(config.name, integration);
    return integration;
  }

  /**
   * Get integration by name
   */
  get(name: string): BaseIntegration | undefined {
    return this.integrations.get(name);
  }

  /**
   * Get all registered integrations
   */
  getAll(): Map<string, BaseIntegration> {
    return this.integrations;
  }

  /**
   * Get all integration statuses
   */
  async getStatuses(): Promise<Record<string, IntegrationConfig>> {
    const statuses: Record<string, IntegrationConfig> = {};

    for (const [name, integration] of this.integrations) {
      statuses[name] = await integration.getStatus();
    }

    return statuses;
  }

  /**
   * Get redacted statuses (no secrets) for API responses
   */
  async getRedactedStatuses(): Promise<Record<string, IntegrationStatus>> {
    const statuses = await this.getStatuses();
    const redacted: Record<string, IntegrationStatus> = {};

    for (const [name, config] of Object.entries(statuses)) {
      const redactedEntry: IntegrationStatus = {
        name,
        type: config.type as IntegrationType,
        status: config.status || 'unknown',
        provider: config.provider,
        lastSync: config.lastSync,
        error: config.error,
      };

      if (config.metadata) {
        redactedEntry.metadata = config.metadata;
      }

      redacted[name] = redactedEntry;
    }

    return redacted;
  }

  /**
   * Sync all integrations
   */
  async syncAll(): Promise<Record<string, Record<string, unknown>>> {
    const results: Record<string, Record<string, unknown>> = {};

    for (const [name, integration] of this.integrations) {
      try {
        const syncResult = await integration.sync();
        results[name] = syncResult;

        // Persist sync results to config metadata
        const config = await integration.getStatus();
        config.metadata = syncResult;

        // Store updated config in KV if available
        if (this.kv && typeof (this.kv as any).put === 'function') {
          await (this.kv as any).put(
            `integration:${name}`,
            JSON.stringify(config),
            { expirationTtl: 365 * 24 * 60 * 60 }
          );
        }
      } catch (error) {
        results[name] = { error: String(error) };
      }
    }

    return results;
  }

  /**
   * Authenticate all integrations
   */
  async authenticateAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, integration] of this.integrations) {
      try {
        results[name] = await integration.authenticate();
      } catch (error) {
        results[name] = false;
      }
    }

    return results;
  }

  /**
   * Load all integrations from KV storage
   */
  async loadFromStorage(): Promise<void> {
    if (!this.kv || typeof (this.kv as any).list !== 'function') {
      return;
    }

    const listResult = await (this.kv as any).list({ prefix: 'integration:' });
    const keys = listResult.keys || [];

    for (const keyObj of keys) {
      const key = typeof keyObj === 'string' ? keyObj : keyObj.name;
      const config = await (this.kv as any).get(key, 'json');

      if (config && config.enabled) {
        try {
          this.createIntegration(config);
        } catch (error) {
          console.error(`Failed to load integration ${config.name}:`, error);
        }
      }
    }
  }

  /**
   * Get integration metrics for dashboard
   */
  async getDashboardMetrics(): Promise<Record<string, unknown>> {
    const redacted = await this.getRedactedStatuses();
    const connected = Object.values(redacted).filter((s) => s.status === 'connected').length;
    const errors = Object.values(redacted).filter((s) => s.status === 'error').length;

    return {
      totalIntegrations: this.integrations.size,
      connected,
      disconnected: this.integrations.size - connected - errors,
      errors,
      integrations: redacted,
    };
  }
}

// Singleton instance
let registryInstance: IntegrationRegistry | null = null;

export function getIntegrationRegistry(kv?: Record<string, unknown>): IntegrationRegistry {
  if (!registryInstance) {
    registryInstance = new IntegrationRegistry(kv);
  }
  return registryInstance;
}
