import { MasterConfigSchema, type MasterConfig } from '../packages/schema/src/system.ts';

const DEFAULT_ACCOUNT_ID = 'f77de112d2019e5456a3198a8bb50bd2';
const DEFAULT_NAMESPACE_ID = '9cc2209906a94851b704be57543987a9';

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID;
const NAMESPACE_ID = process.env.GS_KV_NAMESPACE_ID ?? DEFAULT_NAMESPACE_ID;

const MASTER_CONFIG: MasterConfig = {
  ROUTING_TABLE: {
    'gateway.goldshore.ai': { role: 'ingress', worker: 'gs-gateway' },
    'agent.goldshore.ai': { role: 'alias', target: 'gateway.goldshore.ai' },
    'api.goldshore.ai': { role: 'backend', worker: 'gs-api' },
    'admin.goldshore.ai': { role: 'frontend', project: 'gs-admin-pages' },
    'mail.goldshore.ai': { role: 'mx-only', provider: 'cloudflare-email' },
  },
  SERVICE_STATUS: {
    maintenance_mode: false,
    active_services: ['gateway', 'api', 'agent', 'admin'],
  },
  AI_ORCHESTRATION: {
    preferred_model: 'gpt-4-turbo',
    agent_modules: ['operator-assist', 'market-intel'],
    queue_concurrency: 10,
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
    const data = await finalVerify.json() as { success?: boolean; inbox?: { count?: number } };

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
  const parseResult = MasterConfigSchema.safeParse(MASTER_CONFIG);

  if (!parseResult.success) {
    console.error('❌ Invalid MASTER_CONFIG.');
    console.error(parseResult.error.format());
    process.exitCode = 1;
    return;
  }

  await syncConfig(parseResult.data);
  await runFinalVerification();
}

main().catch((error) => {
  console.error('❌ System sync failed:', error);
  process.exitCode = 1;
});
