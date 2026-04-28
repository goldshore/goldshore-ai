import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import { verifyAccessWithClaims } from "@goldshore/auth";
import * as DNS from "./libs/dns";
import * as Workers from "./libs/workers";
import * as Pages from "./libs/pages";
import * as Access from "./libs/access";
import { syncDNS } from "./tasks/syncDNS";
import { rotateKeys } from "./tasks/rotateKeys";
import { cloudflareRoutes } from "./routes/cloudflare";
const app = new Hono();
// Sentinel: Add security headers to all responses (Defense in Depth)
app.use('*', secureHeaders());
app.use("*", cors({
    origin: (origin, c) => {
        if (!origin) {
            return undefined;
        }
        const allowedOrigins = (c.env.ALLOWED_ORIGINS ?? "https://admin.goldshore.ai,https://admin-preview.goldshore.ai,http://localhost:4321").split(",");
        return allowedOrigins.map((s) => s.trim()).includes(origin) ? origin : undefined;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "CF-Access-Jwt-Assertion"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true
}));
// Sentinel: CRITICAL - Enforce Authentication on all sensitive endpoints
app.use('*', async (c, next) => {
    // Allow root (status check) to remain public
    if (c.req.path === '/' || c.req.method === "OPTIONS") {
        await next();
        return;
    }
    const claims = await verifyAccessWithClaims(c.req.raw, c.env);
    if (!claims) {
        return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('accessClaims', claims);
    await next();
});
app.get("/", (c) => c.json({ service: "gs-control", ok: true }));
app.post("/dns/apply", async (c) => {
    const result = await DNS.sync(c.env);
    return c.json(result);
});
app.post("/workers/reconcile", async (c) => {
    const result = await Workers.reconcile(c.env);
    return c.json(result);
});
app.post("/pages/deploy", async (c) => {
    const result = await Pages.deploy(c.env);
    return c.json(result);
});
app.post("/access/audit", async (c) => {
    const report = await Access.audit(c.env);
    return c.json(report);
});
app.route("/cloudflare", cloudflareRoutes);
export default {
    fetch: app.fetch,
    async scheduled(_controller, env, _ctx) {
        await env.CONTROL_LOGS.put(Date.now().toString(), "control-run");
        await syncDNS(env);
        await rotateKeys(env);
    }
};
