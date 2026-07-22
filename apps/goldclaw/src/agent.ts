import { GoldShoreClient } from './lib/goldshore-client';
import { GoogleAPIsClient } from './lib/google-apis';
import { checkIntegrationHealth } from './tools/health';
import { analyzeOAuthTokenExpiry } from './tools/health';
import { getIntegrationCostAnalysis } from './tools/health';
import { testApiConnection } from './tools/health';
import { fetchAuditTrail } from './tools/health';

interface ScheduledJob {
  name: string;
  interval: number; // milliseconds
  fn: () => Promise<void>;
  lastRun?: Date;
}

class GoldClawAgent {
  private api: GoldShoreClient;
  private google: GoogleAPIsClient;
  private jobs: ScheduledJob[] = [];

  constructor() {
    this.api = new GoldShoreClient(
      process.env.GOLDSHORE_API_URL || 'https://api.goldshore.ai',
      process.env.GOLDSHORE_API_TOKEN || ''
    );

    this.google = new GoogleAPIsClient({
      serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT || '',
      adsApiDeveloperToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    });
  }

  private registerJobs(): void {
    // Hourly health checks
    this.jobs.push({
      name: 'health-check',
      interval: 60 * 60 * 1000, // 1 hour
      fn: this.runHealthCheck.bind(this),
    });

    // Daily cost reports
    this.jobs.push({
      name: 'cost-report',
      interval: 24 * 60 * 60 * 1000, // 1 day
      fn: this.runCostReport.bind(this),
    });

    // Token expiry scans (twice daily)
    this.jobs.push({
      name: 'token-expiry-scan',
      interval: 12 * 60 * 60 * 1000, // 12 hours
      fn: this.runTokenExpiryScan.bind(this),
    });

    // Weekly audit analysis
    this.jobs.push({
      name: 'audit-analysis',
      interval: 7 * 24 * 60 * 60 * 1000, // 7 days
      fn: this.runAuditAnalysis.bind(this),
    });
  }

  private async runHealthCheck(): Promise<void> {
    console.log('[HealthCheck] Starting integration health checks...');
    try {
      const integrations = await this.api.getIntegrations();
      for (const integration of integrations) {
        const health = await checkIntegrationHealth(this.api, integration.id);
        console.log(`[HealthCheck] ${integration.name}: ${health.status}`);

        if (health.status === 'critical') {
          await this.api.logAdminAction({
            action: 'goldclaw.health_alert',
            status: 'critical',
            metadata: {
              integration_id: integration.id,
              error_count: health.errorCount,
              last_error: health.lastError,
            },
          });
        }
      }
    } catch (error) {
      console.error('[HealthCheck] Error:', error);
    }
  }

  private async runCostReport(): Promise<void> {
    console.log('[CostReport] Generating daily cost report...');
    try {
      const integrations = await this.api.getIntegrations();
      const costs = await Promise.all(
        integrations.map((int) =>
          getIntegrationCostAnalysis(this.api, this.google, int.id)
        )
      );

      const totalCost = costs.reduce((sum, c) => sum + c.estimatedMonthlyCost, 0);
      const costByProvider: Record<string, number> = {};

      for (const cost of costs) {
        costByProvider[cost.provider] =
          (costByProvider[cost.provider] || 0) + cost.estimatedMonthlyCost;
      }

      console.log(`[CostReport] Total estimated monthly cost: $${totalCost.toFixed(2)}`);
      console.log('[CostReport] Cost by provider:', costByProvider);

      await this.api.logAdminAction({
        action: 'goldclaw.cost_report',
        status: 'success',
        metadata: {
          total_cost: totalCost,
          cost_by_provider: costByProvider,
          integration_count: integrations.length,
        },
      });
    } catch (error) {
      console.error('[CostReport] Error:', error);
    }
  }

  private async runTokenExpiryScan(): Promise<void> {
    console.log('[TokenScan] Scanning for expiring OAuth tokens...');
    try {
      const expiringTokens = await analyzeOAuthTokenExpiry(this.api);

      for (const token of expiringTokens) {
        console.log(
          `[TokenScan] Token ${token.id} expires in ${token.daysUntilExpiry} days`
        );

        if (token.daysUntilExpiry <= 7) {
          await this.requestTokenRotationApproval(token);
        }
      }
    } catch (error) {
      console.error('[TokenScan] Error:', error);
    }
  }

  private async requestTokenRotationApproval(token: {
    id: string;
    integrationId: string;
    provider: string;
    expiresAt: string;
  }): Promise<void> {
    const daysLeft = Math.ceil(
      (new Date(token.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    const recentAudit = await fetchAuditTrail(
      this.api,
      token.integrationId,
      30
    );
    const errorCount = recentAudit.filter((a) => a.status === 'error').length;
    const uptime = errorCount === 0 ? '99.9%' : `${Math.round((1 - errorCount / recentAudit.length) * 100)}%`;
    const riskLevel = errorCount === 0 ? 'low ✅' : 'medium ⚠️';

    const message = `🔑 ${token.provider} key rotation needed
Expires in: ${daysLeft} day${daysLeft !== 1 ? 's' : ''}
Recent uptime: ${uptime}
Risk: ${riskLevel}

React ✅ to approve rotation`;

    await this.api.queueCommand({
      command: `rotate-${token.provider}`,
      metadata: {
        secret_id: token.id,
        integration_id: token.integrationId,
        risk_level: riskLevel,
        uptime: uptime,
      },
      approval_method: 'whatsapp_reaction',
      message,
    });

    console.log(`[TokenScan] Approval request queued for ${token.provider}`);
  }

  private async runAuditAnalysis(): Promise<void> {
    console.log('[AuditAnalysis] Analyzing audit trail patterns...');
    try {
      const integrations = await this.api.getIntegrations();
      const patterns: Record<string, number> = {};

      for (const integration of integrations) {
        const audit = await fetchAuditTrail(this.api, integration.id, 7);
        for (const entry of audit) {
          const key = `${entry.action}:${entry.status}`;
          patterns[key] = (patterns[key] || 0) + 1;
        }
      }

      console.log('[AuditAnalysis] Pattern summary:', patterns);

      await this.api.logAdminAction({
        action: 'goldclaw.audit_analysis',
        status: 'success',
        metadata: { patterns },
      });
    } catch (error) {
      console.error('[AuditAnalysis] Error:', error);
    }
  }

  private async runScheduledJobs(): Promise<void> {
    const now = Date.now();

    for (const job of this.jobs) {
      if (!job.lastRun || now - job.lastRun.getTime() >= job.interval) {
        console.log(`[Scheduler] Running ${job.name}...`);
        job.lastRun = new Date();
        try {
          await job.fn();
        } catch (error) {
          console.error(`[Scheduler] Job ${job.name} failed:`, error);
        }
      }
    }
  }

  async start(): Promise<void> {
    console.log('🦅 Goldclaw Agent starting...');
    console.log(`API URL: ${process.env.GOLDSHORE_API_URL}`);

    this.registerJobs();

    // Run scheduler every minute
    setInterval(this.runScheduledJobs.bind(this), 60 * 1000);

    // Run initial checks immediately
    await this.runHealthCheck();
    await this.runTokenExpiryScan();

    console.log('✅ Goldclaw Agent running');
  }
}

// Start agent
const agent = new GoldClawAgent();
agent.start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
