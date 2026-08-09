import { BaseIntegration, IntegrationConfig } from './BaseIntegration';

export interface CustomEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  name: string;
  description?: string;
}

export class CustomIntegration extends BaseIntegration {
  private apiUrl: string;
  private apiKey: string;
  private endpoints: CustomEndpoint[] = [];

  constructor(config: IntegrationConfig) {
    super(config);
    this.apiUrl = config.apiKey || '';
    this.apiKey = config.apiSecret || '';
    this.endpoints = (config.metadata?.endpoints as CustomEndpoint[]) || [];
  }

  async authenticate(): Promise<boolean> {
    try {
      if (!this.apiUrl) {
        throw new Error('API URL not configured');
      }

      const response = await fetch(this.apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
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
   * Call custom API endpoint
   */
  async callEndpoint(
    method: string,
    path: string,
    data?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      const url = new URL(path, this.apiUrl).toString();
      const options: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      };

      if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error calling custom endpoint:', error);
      return { error: String(error) };
    }
  }

  /**
   * Register custom endpoint
   */
  registerEndpoint(endpoint: CustomEndpoint): void {
    const existing = this.endpoints.findIndex((e) => e.path === endpoint.path);
    if (existing >= 0) {
      this.endpoints[existing] = endpoint;
    } else {
      this.endpoints.push(endpoint);
    }
  }

  /**
   * Get registered endpoints
   */
  getEndpoints(): CustomEndpoint[] {
    return this.endpoints;
  }

  /**
   * Sync custom integration data
   */
  async sync(): Promise<Record<string, unknown>> {
    try {
      const results: Record<string, unknown> = {};

      for (const endpoint of this.endpoints) {
        try {
          results[endpoint.name] = await this.callEndpoint(endpoint.method, endpoint.path);
        } catch (error) {
          results[endpoint.name] = { error: String(error) };
        }
      }

      this.config.lastSync = new Date().toISOString();
      this.config.status = 'connected';

      return {
        apiUrl: this.apiUrl,
        endpoints: this.endpoints.map((e) => ({ name: e.name, path: e.path, method: e.method })),
        results,
        lastSync: this.config.lastSync,
      };
    } catch (error) {
      this.config.status = 'error';
      this.config.error = String(error);
      return { error: String(error) };
    }
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(event: Record<string, unknown>): Promise<void> {
    await this.logEvent('custom_webhook', event, {} as any);
  }
}
