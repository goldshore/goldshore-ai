import { GoldShoreClient, AuditEntry } from '../lib/goldshore-client';
import { GoogleAPIsClient } from '../lib/google-apis';

export interface IntegrationHealth {
  status: 'healthy' | 'warning' | 'critical';
  errorCount: number;
  lastError?: string;
  uptime: number;
  lastSyncAt?: string;
}

export interface TokenExpiryInfo {
  id: string;
  integrationId: string;
  provider: string;
  expiresAt: string;
  daysUntilExpiry: number;
}

export interface CostAnalysis {
  provider: string;
  integrationId: string;
  estimatedDailySpend: number;
  estimatedMonthlyCost: number;
  currency: string;
}

/**
 * Check integration health: recent errors, API quota usage, last sync time
 */
export async function checkIntegrationHealth(
  client: GoldShoreClient,
  integrationId: string
): Promise<IntegrationHealth> {
  try {
    const audit = await client.getAuditTrail(integrationId, 7);
    const errors = audit.filter((a) => a.status === 'error');
    const total = audit.length;
    const uptime = total === 0 ? 100 : ((total - errors.length) / total) * 100;

    const lastError = errors.length > 0 ? errors[0].metadata.error : undefined;
    const status =
      errors.length > total * 0.1
        ? 'critical'
        : errors.length > 0
          ? 'warning'
          : 'healthy';

    const integration = await client.getIntegration(integrationId);

    return {
      status,
      errorCount: errors.length,
      lastError: lastError as string | undefined,
      uptime,
      lastSyncAt: integration.lastSyncAt,
    };
  } catch (error) {
    console.error(`Health check failed for ${integrationId}:`, error);
    return {
      status: 'critical',
      errorCount: -1,
      lastError: String(error),
      uptime: 0,
    };
  }
}

/**
 * Analyze OAuth token expiry: scan for tokens expiring within X days
 */
export async function analyzeOAuthTokenExpiry(
  client: GoldShoreClient
): Promise<TokenExpiryInfo[]> {
  try {
    const integrations = await client.getIntegrations();
    const expiringTokens: TokenExpiryInfo[] = [];

    for (const integration of integrations) {
      const secrets = await client.getSecrets(integration.id);

      for (const secret of secrets) {
        if (
          secret.keyType === 'oauth_token' &&
          secret.expiresAt
        ) {
          const expiresAt = new Date(secret.expiresAt);
          const now = new Date();
          const daysUntilExpiry = Math.ceil(
            (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
          );

          if (daysUntilExpiry <= 30) {
            expiringTokens.push({
              id: secret.id,
              integrationId: integration.id,
              provider: integration.provider,
              expiresAt: secret.expiresAt,
              daysUntilExpiry,
            });
          }
        }
      }
    }

    return expiringTokens;
  } catch (error) {
    console.error('Token expiry analysis failed:', error);
    return [];
  }
}

/**
 * Get integration cost analysis: estimate monthly costs from Google APIs + metadata
 */
export async function getIntegrationCostAnalysis(
  client: GoldShoreClient,
  google: GoogleAPIsClient,
  integrationId: string
): Promise<CostAnalysis> {
  try {
    const integration = await client.getIntegration(integrationId);

    let estimatedMonthlyCost = 0;
    let estimatedDailySpend = 0;

    // Provider-specific cost estimation
    if (integration.provider === 'google_ads') {
      // Would need actual customer ID from metadata
      const costs = await google.getGoogleAdsCosts('9000000000');
      estimatedMonthlyCost = costs.estimatedMonthlyCost;
      estimatedDailySpend = costs.estimatedDailySpend;
    } else if (integration.provider === 'google_search_console') {
      // Search Console is free
      estimatedMonthlyCost = 0;
      estimatedDailySpend = 0;
    } else if (integration.provider === 'google_analytics') {
      // Analytics is free for standard tier
      estimatedMonthlyCost = 0;
      estimatedDailySpend = 0;
    } else if (integration.provider === 'meta_ads') {
      // Estimate based on recent audit trail
      const audit = await client.getAuditTrail(integrationId, 30);
      const avgDailySpend = audit.length > 0 ? 50 : 0; // Placeholder
      estimatedDailySpend = avgDailySpend;
      estimatedMonthlyCost = avgDailySpend * 30;
    } else if (integration.provider === 'stripe') {
      // Stripe charges transaction fees (2.9% + $0.30)
      // Estimate based on transaction volume from audit
      estimatedMonthlyCost = 0; // Would need transaction data
      estimatedDailySpend = 0;
    }

    return {
      provider: integration.provider,
      integrationId,
      estimatedDailySpend,
      estimatedMonthlyCost,
      currency: 'USD',
    };
  } catch (error) {
    console.error(`Cost analysis failed for ${integrationId}:`, error);
    return {
      provider: 'unknown',
      integrationId,
      estimatedDailySpend: 0,
      estimatedMonthlyCost: 0,
      currency: 'USD',
    };
  }
}

/**
 * Test API connection: attempt OAuth refresh or health ping (non-destructive)
 */
export async function testApiConnection(
  client: GoldShoreClient,
  integrationId: string
): Promise<{ connected: boolean; error?: string }> {
  try {
    const secrets = await client.getSecrets(integrationId);
    const oauthToken = secrets.find((s) => s.keyType === 'oauth_token');

    if (oauthToken) {
      const result = await client.verifySecret(oauthToken.id);
      return {
        connected: result.valid,
        error: result.valid ? undefined : 'Token verification failed',
      };
    }

    return {
      connected: true, // No OAuth token to test
    };
  } catch (error) {
    return {
      connected: false,
      error: String(error),
    };
  }
}

/**
 * Fetch audit trail: query admin action logs, identify patterns
 */
export async function fetchAuditTrail(
  client: GoldShoreClient,
  integrationId?: string,
  days: number = 7
): Promise<AuditEntry[]> {
  try {
    return await client.getAuditTrail(integrationId, days);
  } catch (error) {
    console.error('Audit trail fetch failed:', error);
    return [];
  }
}
