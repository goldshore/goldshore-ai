import { MasterConfigSchema, type MasterConfig } from '../packages/schema/src/system.ts';

const DEFAULT_ACCOUNT_ID = 'f77de112d2019e5456a3198a8bb50bd2';
const DEFAULT_NAMESPACE_ID = '9cc2209906a94851b704be57543987a9';

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID;
const NAMESPACE_ID = process.env.GS_KV_NAMESPACE_ID ?? DEFAULT_NAMESPACE_ID;

/**
 * MASTER_CONFIG - Authoritative system configuration.
 * Merged from both versions found in the original file to ensure no data loss and full system coverage.
 */
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

async function putKvValue(key: string, value: unknown): Promise<{ key: string; ok: boolean; status: number; detail?: string }> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/kv/namespaces/${NAMESPACE_ID}/values/${encodeURIComponent(key)}`;

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
      return { key, ok: true, status: response.status };
    }

    const error = await response.text();
    return { key, ok: false, status: response.status, detail: error.slice(0, 500) };
  } catch (error) {
    return { key, ok: false, status: 0, detail: String(error) };
  }
}

async function syncConfig(config: MasterConfig): Promise<void> {
  console.log('🚀 Starting GoldShore System Sync (Concurrent)...');

  const entries = Object.entries(config);
  const results = await Promise.all(entries.map(([key, value]) => putKvValue(key, value)));

  for (const result of results) {
    if (result.ok) {
      console.log(`✅ ${result.key} synchronized successfully (HTTP ${result.status}).`);
    } else {
      console.error(`❌ Failed to sync ${result.key} (HTTP ${result.status}): ${result.detail}`);
    }
  }

  if (results.some(result => !result.ok)) {
    throw new Error('Some keys failed to synchronize.');
  }
}

async function runFinalVerification(): Promise<void> {
  console.log('\n📬 Checking /internal/inbox-status...');

  try {
    const finalVerify = await fetch('https://api.goldshore.ai/internal/inbox-status');
    const data = (await finalVerify.json()) as { success?: boolean; inbox?: { count?: number }; message?: string };

    if (finalVerify.ok) {
      console.log(
        `🎉 Verification successful (HTTP ${finalVerify.status})${
          typeof data?.inbox?.count === 'number' ? ` — inbox count: ${data.inbox.count}` : ''
        }.`,
      );
      return;
    }

    console.error(
      `⚠️ Verification endpoint returned HTTP ${finalVerify.status}${
        data?.message ? `: ${data.message}` : ''
      }`,
    );
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
