import { Hono } from "hono";
import { createHash } from "node:crypto";
import { applyAnalysisPolicy, getProvider, type AnalysisRequest } from "@goldshore/ai-providers";
import { AiOrchestrationSchema } from "@goldshore/schema";
import safeStableStringify from "safe-stable-stringify";
import { logAuditEvent } from "@goldshore/utils";
import { requirePermission } from "../auth";
import { Env, Variables } from '../types';

const ai = new Hono<{ Bindings: Env; Variables: Variables }>();

ai.get("/", (c) => c.json({ service: "gs-ai", status: "operational" }));

ai.post("/analysis", requirePermission("ai:analyze"), async (c) => {
  // 1. Load System Orchestration Config
  const rawConfig = await c.env.KV.get("AI_ORCHESTRATION", "json");
  const configResult = AiOrchestrationSchema.safeParse(rawConfig);
  const orchestrator = configResult.success ? configResult.data : AiOrchestrationSchema.parse({});

  let body: AnalysisRequest;
  try {
    body = await c.req.json();
    // Inject the system's preferred model if the request doesn't override it
    if (!body.model) body.model = orchestrator.preferred_model;
  } catch (error) {
    return c.json({ error: "Invalid JSON payload" }, 400);
  }

  let policyResult;
  try {
    policyResult = applyAnalysisPolicy(body);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
  }

  const provider = getProvider(policyResult.sanitized.provider);
  if (!provider) {
    return c.json({ error: "Unsupported provider" }, 400);
  }

  const apiKey = policyResult.sanitized.provider === "openai"
      ? c.env.OPENAI_API_KEY
      : c.env.GEMINI_API_KEY;

  const startedAt = Date.now();
  const inputHash = createHash("sha256")
    .update(safeStableStringify(policyResult.sanitized))
    .digest("hex");
  const cacheKey = `analysis:${inputHash}`;

  let providerResponse: any;
  let isCached = false;

  // Cache Check
  const cached = await c.env.KV.get(cacheKey, "json").catch(() => null);
  if (cached) {
    providerResponse = cached;
    isCached = true;
  }

  if (!providerResponse) {
    // Execution with system-defined retry attempts
    providerResponse = await provider.analyze(policyResult.sanitized.input, {
      apiKey,
      fetch,
      model: body.model,
      retries: orchestrator.retry_attempts
    });

    // Cache Write
    c.executionCtx.waitUntil(
      c.env.KV.put(cacheKey, JSON.stringify(providerResponse), { expirationTtl: 86400 })
    );
  }

  const durationMs = Date.now() - startedAt;

  // Audit Logging
  c.executionCtx.waitUntil(
    logAuditEvent(c.env.KV, {
      action: "ai.analysis",
      status: "success",
      metadata: {
        request: policyResult.sanitized,
        orchestration: orchestrator,
        durationMs,
        cache: isCached ? "HIT" : "MISS",
      },
    })
  );

  return c.json({
    ...providerResponse,
    redactions: policyResult.redactions,
    durationMs,
    orchestrated_by: "gs-control"
  }, {
    headers: { "X-Cache": isCached ? "HIT" : "MISS" }
  });
});

export default ai;
