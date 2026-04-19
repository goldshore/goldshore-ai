import type { ControlEnv } from "../libs/types";

type DnsSyncTarget = {
  hostname: string;
  checkUrl: string;
  expectedTarget?: string;
};

type HostSyncResult = {
  hostname: string;
  checkUrl: string;
  startedAt: string;
  endedAt: string;
  statusCode: number | null;
  success: boolean;
  driftStatus: "in_sync" | "drifted";
  driftNotes: string[];
};

type DnsSyncRunLog = {
  runId: string;
  actor: string;
  startedAt: string;
  endedAt: string;
  success: boolean;
  driftStatus: "in_sync" | "drifted";
  results: HostSyncResult[];
};

const DEFAULT_TARGETS: DnsSyncTarget[] = [
  {
    hostname: "api.goldshore.ai",
    checkUrl: "https://api.goldshore.ai/health",
    expectedTarget: "gs-api",
  },
];

const RUN_INDEX_KEY = "dns_sync_runs_index";
const RUN_PREFIX = "dns_sync_run:";

function resolveTargets(env: ControlEnv): DnsSyncTarget[] {
  const configured = env.DNS_SYNC_TARGETS?.trim();
  if (!configured) {
    return DEFAULT_TARGETS;
  }

  const parsed = JSON.parse(configured) as unknown;
  if (!Array.isArray(parsed)) {
    return DEFAULT_TARGETS;
  }

  const normalized = parsed
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as Record<string, unknown>;
      const hostname = typeof candidate.hostname === "string" ? candidate.hostname.trim() : "";
      const checkUrl = typeof candidate.checkUrl === "string" ? candidate.checkUrl.trim() : "";
      if (!hostname || !checkUrl) return null;
      return {
        hostname,
        checkUrl,
        expectedTarget: typeof candidate.expectedTarget === "string" ? candidate.expectedTarget.trim() : undefined,
      } satisfies DnsSyncTarget;
    })
    .filter((target): target is DnsSyncTarget => Boolean(target));

  return normalized.length ? normalized : DEFAULT_TARGETS;
}

async function syncTarget(env: ControlEnv, target: DnsSyncTarget): Promise<HostSyncResult> {
  const startedAt = new Date().toISOString();
  const driftNotes: string[] = [];

  try {
    const response = await env.API.fetch(target.checkUrl);
    const endedAt = new Date().toISOString();
    const resolvedHost = new URL(response.url).hostname;

    if (!response.ok) {
      driftNotes.push(`Health check failed with HTTP ${response.status}.`);
    }

    if (resolvedHost !== target.hostname) {
      driftNotes.push(`Resolved host '${resolvedHost}' differs from expected hostname '${target.hostname}'.`);
    }

    if (target.expectedTarget) {
      const workerHint = response.headers.get("x-gs-target") ?? response.headers.get("server") ?? "";
      if (workerHint && !workerHint.toLowerCase().includes(target.expectedTarget.toLowerCase())) {
        driftNotes.push(`Response target hint '${workerHint}' does not match expected target '${target.expectedTarget}'.`);
      }
    }

    return {
      hostname: target.hostname,
      checkUrl: target.checkUrl,
      startedAt,
      endedAt,
      statusCode: response.status,
      success: response.ok && driftNotes.length === 0,
      driftStatus: driftNotes.length ? "drifted" : "in_sync",
      driftNotes,
    };
  } catch (error) {
    const endedAt = new Date().toISOString();
    return {
      hostname: target.hostname,
      checkUrl: target.checkUrl,
      startedAt,
      endedAt,
      statusCode: null,
      success: false,
      driftStatus: "drifted",
      driftNotes: [error instanceof Error ? error.message : "Unknown DNS sync error."],
    };
  }
}

async function persistRun(env: ControlEnv, run: DnsSyncRunLog) {
  const runKey = `${RUN_PREFIX}${run.startedAt}:${run.runId}`;
  await env.CONTROL_LOGS.put(runKey, JSON.stringify(run));

  const existing = (await env.CONTROL_LOGS.get(RUN_INDEX_KEY, "json")) as string[] | null;
  const next = [runKey, ...(existing ?? []).filter((key) => key !== runKey)].slice(0, 50);
  await env.CONTROL_LOGS.put(RUN_INDEX_KEY, JSON.stringify(next));
}

export async function syncDNS(env: ControlEnv, actor = "cron:scheduled") {
  const startedAt = new Date().toISOString();
  const runId = crypto.randomUUID();
  const targets = resolveTargets(env);
  const results = await Promise.all(targets.map((target) => syncTarget(env, target)));
  const endedAt = new Date().toISOString();

  const run: DnsSyncRunLog = {
    runId,
    actor,
    startedAt,
    endedAt,
    success: results.every((result) => result.success),
    driftStatus: results.some((result) => result.driftStatus === "drifted") ? "drifted" : "in_sync",
    results,
  };

  await persistRun(env, run);
  return run;
}
