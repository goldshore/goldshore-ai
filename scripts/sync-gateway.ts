import { MasterConfigSchema, type MasterConfig } from '../packages/schema/src/system.ts';

const DEFAULT_ACCOUNT_ID = 'f77de112d2019e5456a3198a8bb50bd2';
const DEFAULT_NAMESPACE_ID = '9cc2209906a94851b704be57543987a9';

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID;
const NAMESPACE_ID = process.env.GS_KV_NAMESPACE_ID ?? DEFAULT_NAMESPACE_ID;

const MASTER_CONFIG: MasterConfig = {
  ROUTING_TABLE: {
    'gateway.goldshore.ai': { role: 'ingress', worker: 'gs-gateway', priority: 1 },
    'agent.goldshore.ai': { role: 'alias', target: 'gateway.goldshore.ai', priority: 1 },
    'api.goldshore.ai': { role: 'backend', worker: 'gs-api', priority: 1 },
    'agent.internal.goldshore.ai': { role: 'backend', worker: 'gs-agent', priority: 1 },
    'admin.goldshore.ai': { role: 'frontend', project: 'gs-admin-pages', priority: 1 },
    'mail.goldshore.ai': { role: 'mx-only', provider: 'cloudflare-email', priority: 1 },
  },
  SERVICE_STATUS: {
    maintenance_mode: false,
    active_services: ['gs-gateway', 'gs-api', 'gs-agent', 'gs-admin'],
    version: '2026-04-15',
    last_sync: new Date().toISOString(),
  },
  AI_ORCHESTRATION: {
    preferred_model: 'gpt-5-mini',
    agent_modules: ['operator-assist', 'market-intel'],
    queue_concurrency: 10,
    retry_attempts: 2,
  },
};

function assertEnvironment(): void {
  if (!CLOUDFLARE_API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN is required.');
  }
}

async function syncConfig(config: MasterConfig): Promise<void> {
  console.log('🚀 Starting GoldShore System Sync...');

  for (const [key, value] of Object.entries(config)) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/kv/namespaces/${NAMESPACE_ID}/values/${key}`;

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(value),
      });

      if (response.ok) {
        console.log(`✅ ${key} synchronized successfully.`);
      } else {
        const error = await response.text();
        console.error(`❌ Failed to sync ${key}: ${error}`);
      }
    } catch (error) {
      console.error(`🚨 Network Error syncing ${key}:`, error);
    }
  }
}

async function runFinalVerification(): Promise<void> {
  console.log('\n📬 Checking /internal/inbox-status...');

  try {
    const finalVerify = await fetch('https://api.goldshore.ai/internal/inbox-status');
    const data = (await finalVerify.json()) as { success?: boolean; inbox?: { count?: number } };

    if (data.success) {
      console.log(`🎉 SYSTEM ONLINE: ${data.inbox?.count ?? 0} emails logged in KV.`);
    } else {
      console.error('⚠️ SYSTEM PARTIAL: API is up but KV logs are inaccessible.');
    }
  } catch (error) {
    console.error('⚠️ Final verification failed due to network/auth issue:', error);
  }
}

async function main(): Promise<void> {
  assertEnvironment();
  const parsedConfig = MasterConfigSchema.parse(MASTER_CONFIG);
  await syncConfig(parsedConfig);
  await runFinalVerification();
}

main().catch((error) => {
  console.error('❌ Sync failed:', error);
  process.exitCode = 1;
});
