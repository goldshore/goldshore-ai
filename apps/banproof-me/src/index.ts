import { Hono } from "hono";

interface BanproofEnv {
  ENV?: string;
  BANPROOF_CONFIG: KVNamespace;
  BANPROOF_DB: D1Database;
  ASSETS: R2Bucket;
  POA_EVENTS_QUEUE: Queue;
  GS_API: Fetcher;
  GS_CONTROL: Fetcher;
}

const app = new Hono<{ Bindings: BanproofEnv }>();

app.get("/health", (c) => c.json({ status: "ok", service: "banproof-me", env: c.env.ENV ?? "unknown" }));
app.get("/", (c) => c.json({ service: "banproof-me", ok: true }));

export default {
  fetch: app.fetch,
};
