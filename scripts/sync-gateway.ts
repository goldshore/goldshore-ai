import {
  AiOrchestrationSchema,
  RoutingTableSchema,
  ServiceStatusSchema,
} from '../packages/schema/src/index.ts';
import { z } from 'zod';

const DEFAULT_ACCOUNT_ID = 'f77de112d2019e5456a3198a8bb50bd2';
const DEFAULT_NAMESPACE_ID = '9cc2209906a94851b704be57543987a9';

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID;
const NAMESPACE_ID = process.env.GS_KV_NAMESPACE_ID ?? DEFAULT_NAMESPACE_ID;

type MasterConfig = {
  ROUTING_TABLE: z.infer<typeof RoutingTableSchema>;
  SERVICE_STATUS: z.infer<typeof ServiceStatusSchema>;
  AI_ORCHESTRATION: z.infer<typeof AiOrchestrationSchema>;
};

/**
 * MASTER_CONFIG - Authoritative system configuration.
 * Merged from both versions found in the original file to ensure no data loss and full system coverage.
 */
const MASTER_CONFIG: MasterConfig = {
  ROUTING_TABLE: {
    // Service-level keys
    'api': { role: 'backend', worker: 'gs-api', priority: 1 },
    'gateway': { role: 'ingress', worker: 'gs-gateway', priority: 1 },
    'agent': { role: 'backend', worker: 'gs-agent', priority: 1 },
    'admin': { role: 'frontend', project: 'gs-admin', priority: 1 },
    'web': { role: 'frontend', project: 'gs-web', priority: 1 },
    'mail': { role: 'mx-only', target: 'gs-mail', priority: 1 },
    // Hostname-level keys
    'gw.goldshore.ai': { role: 'ingress', worker: 'gs-gateway', priority: 1 },
    'agent.goldshore.ai': { role: 'alias', target: 'gateway', priority: 1 },
    'api.goldshore.ai': { role: 'backend', worker: 'gs-api', priority: 1 },
    'agent.internal.goldshore.ai': { role: 'backend', worker: 'gs-agent', priority: 1 },
    'admin.goldshore.ai': { role: 'frontend', project: 'gs-admin-pages', priority: 1 },
    'mail.goldshore.ai': { role: 'mx-only', target: 'gs-mail', priority: 1 },
  },
  SERVICE_STATUS: {
    maintenance_mode: false,
    active_services: ['gs-api', 'gs-gateway', 'gs-agent', 'gs-mail', 'gs-web', 'gs-admin'],
    version: '2026-03-03',
    last_sync: new Date().toISOString(),
  },
  AI_ORCHESTRATION: {
    preferred_model: 'gpt-4-turbo',
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
  assertEnvironment();

  const entries = Object.entries(config);

  // Use Promise.all for concurrent execution to optimize performance
  const results = await Promise.all(entries.map(([key, value]) => putKvValue(key, value)));

  for (const result of results) {
    if (result.ok) {
      console.log(`✅ ${result.key} synchronized successfully (HTTP ${result.status}).`);
    } else {
      console.error(`❌ Failed to sync ${result.key} (HTTP ${result.status}): ${result.detail}`);
    }
  }

  if (results.some(r => !r.ok)) {
    throw new Error('Some keys failed to synchronize.');
  }
}

async function verifyInboxStatus(): Promise<{ ok: boolean; status?: number; detail?: string }> {
  const endpoint = 'https://api.goldshore.ai/internal/inbox-status';
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return { ok: false, status: response.status, detail: `HTTP ${response.status}` };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'Unknown verification error',
    };
  }
}

async function main() {
  try {
    await syncConfig(MASTER_CONFIG);

    console.log('\n📬 Running Verification...');
    const verifyResult = await verifyInboxStatus();
    if (verifyResult.ok) {
        console.log(`🎉 SYSTEM ONLINE: /internal/inbox-status passed (HTTP ${verifyResult.status})`);
    } else {
        console.error(`⚠️ SYSTEM PARTIAL: Verification failed (${verifyResult.detail})`);
    }
  } catch (error) {
    console.error(`❌ sync:infra failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
