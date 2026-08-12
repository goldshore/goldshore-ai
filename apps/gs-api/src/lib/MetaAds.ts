import { BaseIntegration, IntegrationConfig } from './BaseIntegration';

const META_GRAPH_API = 'https://graph.facebook.com/v18.0';

export interface MetaAdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  objective: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  effective_status: string;
  created_time: string;
  updated_time: string;
  budget_remaining?: string;
}

export interface MetaOAuthToken {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export class MetaAdsIntegration extends BaseIntegration {
  private appId: string;
  private businessId: string;
  private accessToken: string;
  private appSecret: string;

  constructor(config: IntegrationConfig) {
    super(config);
    const [appId, businessId, accessToken] = config.apiKey.split(':');
    this.appId = appId || '';
    this.businessId = businessId || '';
    this.accessToken = accessToken || '';
    this.appSecret = config.apiSecret || '';
  }

  async authenticate(): Promise<boolean> {
    try {
      await this.refreshAccessToken();

      const response = await fetch(
        `${META_GRAPH_API}/${this.businessId}?fields=id&access_token=${this.accessToken}`
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
   * Exchange an OAuth authorization code for a short-lived access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<MetaOAuthToken> {
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: redirectUri,
      code,
    });

    const response = await fetch(`${META_GRAPH_API}/oauth/access_token?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Meta OAuth failed: ${response.statusText}`);
    }

    const token = (await response.json()) as MetaOAuthToken;
    this.accessToken = token.access_token;
    return token;
  }

  /**
   * Get ad accounts under the configured business
   */
  async getAdAccounts(): Promise<MetaAdAccount[]> {
    const url = `${META_GRAPH_API}/${this.businessId}/adaccounts?fields=id,name,account_status,currency&access_token=${this.accessToken}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to get ad accounts: ${response.statusText}`);
    }

    const data = (await response.json()) as { data: MetaAdAccount[] };
    return data.data;
  }

  /**
   * Get campaigns for an ad account
   */
  async getCampaigns(adAccountId: string): Promise<MetaCampaign[]> {
    const accountId = adAccountId.replace('act_', '');
    const url = `${META_GRAPH_API}/act_${accountId}/campaigns?fields=id,name,objective,status,effective_status,created_time,updated_time&access_token=${this.accessToken}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to get campaigns: ${response.statusText}`);
    }

    const data = (await response.json()) as { data: MetaCampaign[] };
    return data.data;
  }

  /**
   * Pause, resume, or rename a campaign
   */
  async updateCampaign(
    campaignId: string,
    updates: Record<string, unknown>
  ): Promise<{ success: boolean }> {
    const url = `${META_GRAPH_API}/${campaignId}?access_token=${this.accessToken}`;

    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(updates),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to update campaign: ${response.statusText}`);
    }

    return response.json() as Promise<{ success: boolean }>;
  }

  /**
   * Get insights (spend, impressions, clicks, conversions) for a campaign
   */
  async getCampaignInsights(
    campaignId: string,
    params: Record<string, string> = {}
  ): Promise<unknown> {
    const searchParams = new URLSearchParams({
      ...params,
      access_token: this.accessToken,
    });

    const response = await fetch(`${META_GRAPH_API}/${campaignId}/insights?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to get insights: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Sync all ad accounts and their campaigns
   */
  async sync(): Promise<Record<string, unknown>> {
    try {
      const adAccounts = await this.getAdAccounts();
      const campaignsByAccount: Record<string, MetaCampaign[]> = {};

      for (const account of adAccounts) {
        campaignsByAccount[account.id] = await this.getCampaigns(account.id);
      }

      this.config.lastSync = new Date().toISOString();
      this.config.status = 'connected';

      return {
        businessId: this.businessId,
        adAccounts,
        campaignsByAccount,
        lastSync: this.config.lastSync,
      };
    } catch (error) {
      this.config.status = 'error';
      this.config.error = String(error);
      return { error: String(error) };
    }
  }

  async handleWebhook(event: Record<string, unknown>): Promise<void> {
    await this.logEvent('meta_webhook', event, {} as any);
  }

  /**
   * Verify Meta's X-Hub-Signature-256 webhook signature (HMAC-SHA256 over the
   * raw request body, keyed by the app secret). Not part of the BaseIntegration
   * contract (that hook is synchronous; Web Crypto's HMAC isn't) — call this
   * directly from the webhook route once one exists, before invoking
   * `handleWebhook`.
   */
  async verifyMetaSignature(payload: string, signatureHeader: string): Promise<boolean> {
    const expected = signatureHeader.replace(/^sha256=/, '');
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.appSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const computed = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return computed === expected;
  }

  /**
   * Meta long-lived tokens are refreshed by exchanging the current token for
   * a new one (fb_exchange_token) — there's no separate stored refresh token
   * the way Google's OAuth flow uses one.
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.accessToken) return;

    try {
      const params = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: this.appId,
        client_secret: this.appSecret,
        fb_exchange_token: this.accessToken,
      });

      const response = await fetch(`${META_GRAPH_API}/oauth/access_token?${params.toString()}`);
      if (!response.ok) return;

      const data = (await response.json()) as MetaOAuthToken;
      if (data.access_token) {
        this.accessToken = data.access_token;
      }
    } catch (error) {
      console.error('Error refreshing Meta access token:', error);
    }
  }
}
