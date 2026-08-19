/**
 * Google Ads API Client
 * Enables goldclaw to fetch campaign performance, costs, and budget data
 * Requires: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN
 */

import type { Env } from '../types';
import { getSecretValue } from './secrets';

export interface GoogleAdsMetrics {
  customerId: string;
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  conversions: number;
  costMicros: number; // Cost in micros (divide by 1,000,000 for USD)
  avgCpc: number;
  ctr: number; // Click-through rate
  conversionRate: number;
  roas: number; // Return on ad spend
}

export interface GoogleAdsCostAnalysis {
  totalCostUSD: number;
  monthToDateCost: number;
  projectedMonthlyCost: number;
  costByProvider: Record<string, number>;
  topCampaignsByCost: Array<{
    campaignId: string;
    campaignName: string;
    costUSD: number;
    roas: number;
  }>;
  recommendations: Array<{
    type: 'budget_increase' | 'budget_decrease' | 'pause_campaign' | 'expand_keywords';
    campaignId: string;
    campaignName: string;
    rationale: string;
    estimatedImpact: string;
  }>;
}

/**
 * Fetch Google Ads metrics for a customer
 * Requires valid OAuth token in secrets
 */
export async function fetchGoogleAdsCampaigns(
  env: Env,
  secretId: string,
  customerId: string
): Promise<GoogleAdsMetrics[]> {
  try {
    const accessToken = await getSecretValue(env, secretId);

    if (!accessToken) {
      throw new Error('No access token found for Google Ads');
    }

    const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not configured');
    }

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros,
        metrics.average_cpc,
        metrics.ctr,
        metrics.conversion_rate
      FROM campaign
      WHERE segments.date DURING LAST_30_DAYS
      ORDER BY metrics.cost_micros DESC
    `;

    const response = await fetch('https://googleads.googleapis.com/v25/customers/' + customerId + '/googleAds:search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Ads API error: ${response.status} - ${error}`);
    }

    const data = await response.json<any>();

    return (data.results || []).map((result: any) => ({
      customerId,
      campaignId: result.campaign.id,
      campaignName: result.campaign.name,
      impressions: parseInt(result.metrics.impressions, 10) || 0,
      clicks: parseInt(result.metrics.clicks, 10) || 0,
      conversions: parseInt(result.metrics.conversions, 10) || 0,
      costMicros: parseInt(result.metrics.cost_micros, 10) || 0,
      avgCpc: parseFloat(result.metrics.average_cpc) || 0,
      ctr: parseFloat(result.metrics.ctr) || 0,
      conversionRate: parseFloat(result.metrics.conversion_rate) || 0,
      roas: calculateROAS(
        parseInt(result.metrics.conversions, 10),
        parseFloat(result.metrics.conversion_value) || 0,
        parseInt(result.metrics.cost_micros, 10)
      ),
    }));
  } catch (error) {
    console.error('Failed to fetch Google Ads campaigns:', error);
    throw new Error('Failed to fetch Google Ads data');
  }
}

/**
 * Analyze cost patterns and generate recommendations
 */
export function analyzeCosts(campaigns: GoogleAdsMetrics[]): GoogleAdsCostAnalysis {
  const totalCostUSD = campaigns.reduce((sum, c) => sum + c.costMicros / 1_000_000, 0);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const monthToDateCost = totalCostUSD;
  const projectedMonthlyCost = (monthToDateCost / dayOfMonth) * daysInMonth;

  const topCampaignsByCost = campaigns
    .sort((a, b) => b.costMicros - a.costMicros)
    .slice(0, 10)
    .map((c) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      costUSD: c.costMicros / 1_000_000,
      roas: c.roas,
    }));

  const recommendations = generateRecommendations(campaigns, projectedMonthlyCost);

  return {
    totalCostUSD,
    monthToDateCost,
    projectedMonthlyCost,
    costByProvider: { google_ads: totalCostUSD },
    topCampaignsByCost,
    recommendations,
  };
}

/**
 * Calculate ROAS (Return on Ad Spend)
 */
function calculateROAS(conversions: number, conversionValue: number, costMicros: number): number {
  if (costMicros === 0) return 0;
  const costUSD = costMicros / 1_000_000;
  return conversionValue > 0 ? conversionValue / costUSD : 0;
}

/**
 * Generate AI-style recommendations based on metrics
 */
function generateRecommendations(
  campaigns: GoogleAdsMetrics[],
  projectedMonthlyCost: number
): GoogleAdsCostAnalysis['recommendations'] {
  const recommendations: GoogleAdsCostAnalysis['recommendations'] = [];

  campaigns.forEach((campaign) => {
    const costUSD = campaign.costMicros / 1_000_000;

    // Low ROAS recommendation
    if (campaign.roas < 2 && costUSD > 100) {
      recommendations.push({
        type: 'budget_decrease',
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        rationale: `Campaign has low ROAS (${campaign.roas.toFixed(2)}x) with high spend (${costUSD.toFixed(2)} USD)`,
        estimatedImpact: 'Could reduce spend by 20-30% while maintaining conversions',
      });
    }

    // High efficiency recommendation
    if (campaign.roas > 4 && costUSD < 500 && campaign.clicks > 100) {
      recommendations.push({
        type: 'budget_increase',
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        rationale: `Campaign highly efficient (${campaign.roas.toFixed(2)}x ROAS) with room to scale`,
        estimatedImpact: 'Could increase budget by 30-50% to capture more high-intent traffic',
      });
    }

    // Low CTR recommendation
    if (campaign.ctr < 0.01 && campaign.impressions > 1000) {
      recommendations.push({
        type: 'expand_keywords',
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        rationale: `Campaign has low CTR (${(campaign.ctr * 100).toFixed(2)}%) despite high impressions`,
        estimatedImpact: 'Ad copy or targeting optimization could improve CTR by 20-40%',
      });
    }
  });

  return recommendations.slice(0, 5); // Limit to top 5 recommendations
}

/**
 * Refresh Google Ads OAuth token using refresh token
 */
export async function refreshGoogleAdsToken(
  env: Env,
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Google Ads token');
  }

  const data = await response.json<any>();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
  };
}
