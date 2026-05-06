import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { verifyAccess } from "@goldshore/auth";

interface AgentEnv {
  ENV?: string;
}

const app = new Hono<{ Bindings: AgentEnv }>();

app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "CF-Access-Jwt-Assertion"],
  }),
);

app.use("*", async (c, next) => {
  if (c.req.path === "/" || c.req.path === "/health") {
    await next();
    return;
  }

  const authorized = await verifyAccess(c.req.raw, c.env);
  if (!authorized) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});

app.get("/", (c) => c.json({ service: "gs-agent", ok: true }));
app.get("/health", (c) => c.json({ status: "ok", service: "gs-agent" }));

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<unknown>, _env: AgentEnv, _ctx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      console.info("processed queue message", { id: message.id });
      message.ack();
    }
  },
};
