import { Hono } from 'hono';
import { loadSystemSyncSnapshot } from './system.config';
import {
  ServiceStatusSchema,
} from '@goldshore/schema';
import { requirePermission } from '../auth';
import { Env, Variables } from '../types';

const internal = new Hono<{ Bindings: Env; Variables: Variables }>();

const DNS_SYNC_RUN_INDEX_KEY = 'dns_sync_runs_index';

type DnsSyncRun = {
  runId: string;
  actor: string;
  startedAt: string;
  endedAt: string;
  success: boolean;
  driftStatus: 'in_sync' | 'drifted';
  results: Array<{
    hostname: string;
    checkUrl: string;
    startedAt: string;
    endedAt: string;
    statusCode: number | null;
    success: boolean;
    driftStatus: 'in_sync' | 'drifted';
    driftNotes: string[];
  }>;
};

const parseDnsSyncRun = (value: unknown): DnsSyncRun | null => {
  if (!value || typeof value !== 'object') return null;
  const run = value as DnsSyncRun;
  if (!run.runId || !Array.isArray(run.results)) return null;
  return run;
};

/**
 * [SOP] Internal Status Endpoint
 * Aggregates system health and mail logs for the Admin Dashboard.
 */
internal.get('/inbox-status', requirePermission('system:read'), async (c) => {
  try {
    const snapshot = await loadSystemSyncSnapshot(c.env.KV);

    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      services: snapshot.SERVICE_STATUS,
      inbox: {
        count: snapshot.EMAIL_INBOX_LOGS.length,
        recent: snapshot.EMAIL_INBOX_LOGS.slice(0, 5),
      },
      routing: {
        hostCount: Object.keys(snapshot.ROUTING_TABLE).length,
      },
      orchestration: {
        preferredModel: snapshot.AI_ORCHESTRATION.preferred_model,
        queueConcurrency: snapshot.AI_ORCHESTRATION.queue_concurrency,
      },
    });
  } catch (error) {
    console.error('Internal API Error:', error);
    return c.json({ success: false, error: 'Failed to retrieve internal system state' }, 500);
  }
});

internal.get('/dns-sync-status', requirePermission('system:read'), async (c) => {
  const controlLogs = c.env.CONTROL_LOGS ?? c.env.KV;
  const [serviceStatusRaw, runIndexRaw] = await Promise.all([
    c.env.KV.get('SERVICE_STATUS', 'json'),
    controlLogs.get(DNS_SYNC_RUN_INDEX_KEY, 'json'),
  ]);

  const statusResult = ServiceStatusSchema.safeParse(serviceStatusRaw);
  const runKeys = Array.isArray(runIndexRaw) ? runIndexRaw.filter((key): key is string => typeof key === 'string') : [];
  const runsRaw = await Promise.all(runKeys.slice(0, 20).map((key) => controlLogs.get(key, 'json')));
  const runs = runsRaw
    .map(parseDnsSyncRun)
    .filter((run): run is DnsSyncRun => Boolean(run))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const latestRun = runs[0] ?? null;
  const inferredLastSync = statusResult.success ? statusResult.data.last_sync ?? null : null;
  const verifiedLastSync = latestRun?.endedAt ?? inferredLastSync;

  return c.json({
    success: true,
    checkedAt: new Date().toISOString(),
    latestRun,
    runs,
    masterConfigReport: {
      lastSyncTimestampVerified: verifiedLastSync,
      syncSource: latestRun ? 'durable' : inferredLastSync ? 'inferred' : 'none',
      driftStatusComputed: latestRun?.driftStatus ?? 'unknown',
    },
  });
});

export default internal;
