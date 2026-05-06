import { Hono } from "hono";
import { buildAdminSession } from "@goldshore/auth";
import { withContractHeaders } from "./contract";

type SystemEnv = {
  KV: KVNamespace;
  API_VERSION?: string;
  DEPLOY_SHA?: string;
};

type SystemVariables = {
  accessClaims: import("@goldshore/auth").AccessTokenPayload | null;
};

type SystemConfig = {
  maintenanceMode: boolean;
  maxConcurrency: number;
  notes: string;
};

const DEFAULT_CONFIG: SystemConfig = {
  maintenanceMode: false,
  maxConcurrency: 120,
  notes: ""
};

const CONFIG_KEY = "gs-api:config";

const parseConfig = (input: Partial<SystemConfig> | null): SystemConfig => {
  if (!input) {
    return { ...DEFAULT_CONFIG };
  }

  return {
    maintenanceMode: Boolean(input.maintenanceMode),
    maxConcurrency:
      typeof input.maxConcurrency === "number" && Number.isFinite(input.maxConcurrency)
        ? Math.max(1, Math.floor(input.maxConcurrency))
        : DEFAULT_CONFIG.maxConcurrency,
    notes: typeof input.notes === "string" ? input.notes.slice(0, 500) : DEFAULT_CONFIG.notes
  };
};

const readConfig = async (kv: KVNamespace) => {
  const stored = await kv.get<SystemConfig>(CONFIG_KEY, "json");
  return parseConfig(stored);
};

const system = new Hono<{ Bindings: SystemEnv; Variables: SystemVariables }>();

system.get("/info", (c) => {
  return c.json(withContractHeaders({
    service: "gs-api",
    timestamp: Date.now(),
  }, c.env.API_VERSION));
});

system.get("/status", async (c) => {
  return c.json(withContractHeaders({
    service: "gs-api",
    status: "online",
    uptime: `${Math.floor(performance.now() / 1000)}s`,
    timestamp: Date.now()
  }, c.env.API_VERSION));
});

system.get("/version", async (c) => {
  return c.json(withContractHeaders({
    service: "gs-api",
    version: c.env.API_VERSION ?? "unknown",
    deploySha: c.env.DEPLOY_SHA ?? null,
    timestamp: Date.now()
  }, c.env.API_VERSION));
});

system.get("/config", async (c) => {
  const config = await readConfig(c.env.KV);
  return c.json(withContractHeaders({ config }, c.env.API_VERSION));
});

system.put("/config", async (c) => {
  const adminSession = buildAdminSession(c.get("accessClaims"));
  if (!adminSession.roles.includes("admin")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const payload = await c.req.json<Partial<SystemConfig>>().catch(() => null);
  const config = parseConfig(payload);
  await c.env.KV.put(CONFIG_KEY, JSON.stringify(config));
  return c.json(withContractHeaders({ config }, c.env.API_VERSION));
});

export default system;
