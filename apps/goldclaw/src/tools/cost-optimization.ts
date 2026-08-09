import { GoldShoreClient } from '../lib/goldshore-client';
import { GoogleAPIsClient } from '../lib/google-apis';

export interface CostAnomaly {
  integrationId: string;
  provider: string;
  currentSpend: number;
  previousSpend: number;
  changePercent: number;
  anomalyType: 'spike' | 'trend' | 'outlier';
  recommendation: string;
  estimatedSavings: number;
}

export interface CostReport {
  totalMonthlyCost: number;
  averageDailySpend: number;
  anomalies: CostAnomaly[];
  topCostDrivers: Array<{ provider: string; cost: number }>;
  recommendations: string[];
}

/**
 * Detect cost anomalies: spikes, trends, and outliers
 */
export async function analyzeCostAnomalies(
  client: GoldShoreClient,
  google: GoogleAPIsClient
): Promise<CostReport> {
  try {
    const integrations = await client.getIntegrations();
    const anomalies: CostAnomaly[] = [];
    let totalMonthlyCost = 0;
    const costByProvider: Record<string, number> = {};

    for (const integration of integrations) {
      try {
        const audit = await client.getAuditTrail(integration.id, 30);
        const costs = [];

        // Aggregate daily costs from audit trail
        for (let day = 0; day < 30; day++) {
          const dayStart = new Date();
          dayStart.setDate(dayStart.getDate() - day);
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);

          const dayEntries = audit.filter(
            (a) =>
              new Date(a.createdAt) >= dayStart &&
              new Date(a.createdAt) < dayEnd &&
              a.metadata.cost
          );

          const dayCost = dayEntries.reduce(
            (sum, e) => sum + (Number(e.metadata.cost) || 0),
            0
          );
          if (dayCost > 0) {
            costs.push(dayCost);
          }
        }

        if (costs.length >= 2) {
          const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
          const latestCost = costs[0];
          const previousCost = costs[costs.length - 1];
          const changePercent = ((latestCost - previousCost) / previousCost) * 100;

          // Detect spike (>50% increase day-over-day)
          if (changePercent > 50) {
            anomalies.push({
              integrationId: integration.id,
              provider: integration.provider,
              currentSpend: latestCost,
              previousSpend: previousCost,
              changePercent,
              anomalyType: 'spike',
              recommendation: `${integration.provider} costs spiked ${changePercent.toFixed(1)}%. Investigate recent activity or usage changes.`,
              estimatedSavings: latestCost * 0.15, // Estimate 15% recovery
            });
          }

          // Detect trend (consistent increase over 7 days)
          if (costs.length >= 7) {
            const week1Avg = costs.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
            const week2Avg = costs.slice(7, 14).reduce((a, b) => a + b, 0) / 7;
            const trendPercent = ((week2Avg - week1Avg) / week1Avg) * 100;

            if (trendPercent > 20) {
              anomalies.push({
                integrationId: integration.id,
                provider: integration.provider,
                currentSpend: week2Avg,
                previousSpend: week1Avg,
                changePercent: trendPercent,
                anomalyType: 'trend',
                recommendation: `${integration.provider} shows upward cost trend (+${trendPercent.toFixed(1)}% week-over-week). Consider usage optimization.`,
                estimatedSavings: week2Avg * 0.2,
              });
            }
          }
        }

        // Google Ads specific analysis
        if (
          integration.provider === 'google_ads' &&
          integration.metadata?.customerId
        ) {
          const adsCosts = await google.getGoogleAdsCosts(
            integration.metadata.customerId
          );
          costByProvider[integration.provider] =
            (costByProvider[integration.provider] || 0) + adsCosts.estimatedMonthlyCost;
          totalMonthlyCost += adsCosts.estimatedMonthlyCost;
        }
      } catch (e) {
        console.error(
          `Cost analysis failed for ${integration.id}:`,
          e
        );
      }
    }

    const topCostDrivers = Object.entries(costByProvider)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([provider, cost]) => ({ provider, cost }));

    const recommendations = generateCostRecommendations(
      anomalies,
      topCostDrivers,
      totalMonthlyCost
    );

    return {
      totalMonthlyCost,
      averageDailySpend: totalMonthlyCost / 30,
      anomalies: anomalies.slice(0, 10), // Top 10 anomalies
      topCostDrivers,
      recommendations,
    };
  } catch (error) {
    console.error('Cost analysis failed:', error);
    return {
      totalMonthlyCost: 0,
      averageDailySpend: 0,
      anomalies: [],
      topCostDrivers: [],
      recommendations: ['Cost analysis failed. Please check integrations.'],
    };
  }
}

/**
 * Generate actionable cost reduction recommendations
 */
function generateCostRecommendations(
  anomalies: CostAnomaly[],
  topDrivers: Array<{ provider: string; cost: number }>,
  totalCost: number
): string[] {
  const recs: string[] = [];

  if (anomalies.length > 0) {
    recs.push(
      `⚠️ Detected ${anomalies.length} cost anomaly(ies). Most critical: ${anomalies[0].provider} (${anomalies[0].changePercent > 0 ? '+' : ''}${anomalies[0].changePercent.toFixed(1)}%).`
    );
  }

  if (topDrivers.length > 0) {
    const top = topDrivers[0];
    recs.push(
      `💰 Top cost driver: ${top.provider} at $${top.cost.toFixed(2)}/mo. Consider reviewing usage or exploring alternative plans.`
    );
  }

  if (totalCost > 1000) {
    recs.push(
      `📊 Monthly spend exceeds $1,000. Schedule monthly cost review and negotiate volume discounts with providers.`
    );
  }

  if (anomalies.some((a) => a.estimatedSavings > 100)) {
    const totalSavings = anomalies.reduce((sum, a) => sum + a.estimatedSavings, 0);
    recs.push(
      `💡 Potential monthly savings: $${totalSavings.toFixed(2)} if anomalies are addressed.`
    );
  }

  return recs.slice(0, 5);
}

/**
 * Compare costs across two time periods for trend analysis
 */
export async function compareCostTrends(
  client: GoldShoreClient,
  integrationId: string,
  daysPast: number = 30
): Promise<{ trend: 'increasing' | 'decreasing' | 'stable'; changePercent: number }> {
  try {
    const audit = await client.getAuditTrail(integrationId, daysPast);
    const costs: number[] = [];

    for (let day = 0; day < daysPast; day++) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - day);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayEntries = audit.filter(
        (a) =>
          new Date(a.createdAt) >= dayStart &&
          new Date(a.createdAt) < dayEnd &&
          a.metadata.cost
      );

      const dayCost = dayEntries.reduce(
        (sum, e) => sum + (Number(e.metadata.cost) || 0),
        0
      );
      if (dayCost > 0) {
        costs.push(dayCost);
      }
    }

    if (costs.length < 2) {
      return { trend: 'stable', changePercent: 0 };
    }

    const firstHalf = costs.slice(0, Math.floor(costs.length / 2));
    const secondHalf = costs.slice(Math.floor(costs.length / 2));

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const changePercent = ((avgSecond - avgFirst) / avgFirst) * 100;

    return {
      trend:
        changePercent > 5
          ? 'increasing'
          : changePercent < -5
            ? 'decreasing'
            : 'stable',
      changePercent,
    };
  } catch (error) {
    console.error(`Cost trend analysis failed for ${integrationId}:`, error);
    return { trend: 'stable', changePercent: 0 };
  }
}
