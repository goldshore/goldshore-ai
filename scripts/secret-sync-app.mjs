#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const uiPath = resolve(root, "apps/gs-web/public/tools/secret-sync/index.html");
const syncScript = resolve(root, "scripts/sync-secrets.mjs");
const cloudflareAgentAccessScript = resolve(root, "scripts/check-cloudflare-agent-access.mjs");
const localSecretsPath = resolve(root, "env.secrets.runtime.json");
const defaultPort = Number(process.env.SECRET_SYNC_PORT || 8798);
const cloudflareAuthorizeUrl = process.env.CLOUDFLARE_OAUTH_AUTHORIZE_URL || "https://dash.cloudflare.com/oauth2/auth";
const cloudflareTokenUrl = process.env.CLOUDFLARE_OAUTH_TOKEN_URL || "https://dash.cloudflare.com/oauth2/token";
const cloudflareOauthDashboardUrl = "https://dash.cloudflare.com/?to=/:account/oauth-clients";
const cloudflareOauthClientUrl = process.env.CLOUDFLARE_OAUTH_CLIENT_URL || "https://goldshore.ai";
const cloudflareOauthClientName = process.env.CLOUDFLARE_OAUTH_CLIENT_NAME || "GoldShore Secret Sync";
const defaultCloudflareOauthScopes = "workers-kv-storage.read workers-kv-storage.write workers-scripts.write account-settings.read";
const cloudflareAgentPromptUrl = "https://developers.cloudflare.com/agent-setup/prompt.md";
const cloudflareMcpServers = [
  { name: "cloudflare", url: "https://mcp.cloudflare.com/mcp", oauth: true },
  { name: "cloudflare-docs", url: "https://docs.mcp.cloudflare.com/mcp", oauth: false },
  { name: "cloudflare-bindings", url: "https://bindings.mcp.cloudflare.com/mcp", oauth: true },
  { name: "cloudflare-builds", url: "https://builds.mcp.cloudflare.com/mcp", oauth: true },
  { name: "cloudflare-observability", url: "https://observability.mcp.cloudflare.com/mcp", oauth: true },
];

function readLocalSecrets() {
  if (!existsSync(localSecretsPath)) return {};
  try {
    return JSON.parse(readFileSync(localSecretsPath, "utf8"));
  } catch {
    return {};
  }
}

function writeLocalSecrets(updates) {
  const current = readLocalSecrets();
  const next = { ...current };
  for (const [key, value] of Object.entries(updates)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) continue;
    if (typeof value === "string" && value.length > 0) next[key] = value;
  }
  writeFileSync(localSecretsPath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  return Object.keys(updates).filter((key) => /^[A-Z][A-Z0-9_]*$/.test(key) && typeof updates[key] === "string" && updates[key].length > 0);
}

function readJson(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function serverEntries(style) {
  return Object.fromEntries(
    cloudflareMcpServers.map((server) => [
      server.name,
      style === "opencode"
        ? { type: "remote", url: server.url, enabled: true, ...(server.oauth ? { oauth: {} } : {}) }
        : { type: "http", url: server.url },
    ]),
  );
}

function syncMcpFile(path, rootKey, style = "default") {
  const current = readJson(path);
  const container = current[rootKey] && typeof current[rootKey] === "object" ? current[rootKey] : {};
  const entries = serverEntries(style);
  const changed = [];
  for (const [name, config] of Object.entries(entries)) {
    const before = JSON.stringify(container[name] ?? null);
    container[name] = { ...(container[name] ?? {}), ...config };
    if (JSON.stringify(container[name]) !== before) changed.push(name);
  }
  current[rootKey] = container;
  writeJson(path, current);
  return {
    path,
    rootKey,
    changed,
    present: cloudflareMcpServers.map((server) => server.name).filter((name) => Boolean(container[name])),
  };
}

function syncAgentConfigs() {
  return [
    syncMcpFile(resolve(root, ".mcp.json"), "mcpServers"),
    syncMcpFile(resolve(root, ".vscode", "mcp.json"), "servers"),
    syncMcpFile(resolve(root, ".cursor", "mcp.json"), "mcpServers"),
  ];
}

function inspectAgentConfig(path, rootKey) {
  const data = readJson(path);
  const container = data[rootKey] && typeof data[rootKey] === "object" ? data[rootKey] : {};
  return {
    path,
    exists: existsSync(path),
    rootKey,
    present: cloudflareMcpServers.map((server) => server.name).filter((name) => Boolean(container[name])),
    missing: cloudflareMcpServers.map((server) => server.name).filter((name) => !container[name]),
  };
}

async function commandStatus(command) {
  const finder = process.platform === "win32" ? "where.exe" : "which";
  const result = await runCommand(finder, [command], { timeoutMs: 5000 });
  return {
    command,
    available: result.code === 0,
    path: result.stdout.trim().split(/\r?\n/).filter(Boolean)[0] ?? "",
  };
}

async function fetchAgentPrompt() {
  const response = await fetch(cloudflareAgentPromptUrl);
  const content = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    url: cloudflareAgentPromptUrl,
    contentType: response.headers.get("content-type") ?? "",
    length: content.length,
    excerpt: content.slice(0, 700),
  };
}

function generateInternalSecret(name) {
  if (name === "CONTROL_SYNC_TOKEN") return `gst_${base64url(randomBytes(32))}`;
  if (name === "JWT_SECRET") return base64url(randomBytes(48));
  throw new Error(`Cannot auto-generate ${name}; it must come from its provider.`);
}

const localSecrets = readLocalSecrets();

const session = {
  cloudflareAuthToken: process.env.CLOUDFLARE_SYNC_AUTH_TOKEN || localSecrets.CLOUDFLARE_SYNC_AUTH_TOKEN || "",
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || localSecrets.CLOUDFLARE_ACCOUNT_ID || "",
  githubToken: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "",
  cloudflareOauth: null,
  githubDevice: null,
};

function json(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

function text(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function base64url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function openUrl(url) {
  const command =
    process.platform === "win32"
      ? "cmd"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, {
    cwd: root,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

function childEnv(options = {}) {
  const runtimeSecrets = readLocalSecrets();
  const env = {
    ...process.env,
    ...runtimeSecrets,
    CLOUDFLARE_ACCOUNT_ID: session.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || runtimeSecrets.CLOUDFLARE_ACCOUNT_ID || "",
    CLOUDFLARE_SYNC_AUTH_TOKEN: session.cloudflareAuthToken || process.env.CLOUDFLARE_SYNC_AUTH_TOKEN || runtimeSecrets.CLOUDFLARE_SYNC_AUTH_TOKEN || "",
  };
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN;
  const githubAuth = options.githubAuth || "cli";
  const githubToken =
    githubAuth === "token"
      ? session.githubToken || process.env.GH_TOKEN || process.env.GITHUB_TOKEN || runtimeSecrets.GH_TOKEN || runtimeSecrets.GITHUB_TOKEN || ""
      : githubAuth === "auto"
        ? session.githubToken || process.env.GH_TOKEN || process.env.GITHUB_TOKEN || ""
        : "";
  if (githubToken) env.GH_TOKEN = githubToken;
  return env;
}

function cloudflareAuthToken() {
  const runtimeSecrets = readLocalSecrets();
  return (
    session.cloudflareAuthToken ||
    process.env.CLOUDFLARE_SYNC_AUTH_TOKEN ||
    runtimeSecrets.CLOUDFLARE_SYNC_AUTH_TOKEN ||
    process.env.CLOUDFLARE_API_TOKEN ||
    process.env.CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN ||
    ""
  );
}

function cloudflareAccountId() {
  const runtimeSecrets = readLocalSecrets();
  return session.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || runtimeSecrets.CLOUDFLARE_ACCOUNT_ID || "";
}

function cloudflareOauthScopes() {
  return process.env.CLOUDFLARE_OAUTH_SCOPES || defaultCloudflareOauthScopes;
}

function cloudflareOauthClientId() {
  const runtimeSecrets = readLocalSecrets();
  return process.env.CLOUDFLARE_OAUTH_CLIENT_ID || runtimeSecrets.CLOUDFLARE_OAUTH_CLIENT_ID || "";
}

function cloudflareOauthClientSecret() {
  const runtimeSecrets = readLocalSecrets();
  return process.env.CLOUDFLARE_OAUTH_CLIENT_SECRET || runtimeSecrets.CLOUDFLARE_OAUTH_CLIENT_SECRET || "";
}

function cloudflareOauthPublisherTxt() {
  const runtimeSecrets = readLocalSecrets();
  return process.env.CLOUDFLARE_OAUTH_PUBLISHER_TXT || runtimeSecrets.CLOUDFLARE_OAUTH_PUBLISHER_TXT || "";
}

function githubOauthClientId() {
  const runtimeSecrets = readLocalSecrets();
  return process.env.GITHUB_OAUTH_CLIENT_ID || runtimeSecrets.GITHUB_OAUTH_CLIENT_ID || "";
}

function cloudflareOauthConfig(port) {
  const scopeString = cloudflareOauthScopes();
  return {
    dashboardUrl: cloudflareOauthDashboardUrl,
    clientName: cloudflareOauthClientName,
    clientUrl: cloudflareOauthClientUrl,
    redirectUri: `http://127.0.0.1:${port}/oauth/cloudflare/callback`,
    authorizationEndpoint: cloudflareAuthorizeUrl,
    tokenEndpoint: cloudflareTokenUrl,
    responseType: "code",
    grantType: "authorization_code",
    tokenEndpointAuthMethod: "none",
    pkceRequired: true,
    pkceMethod: "S256",
    clientSecretRequired: false,
    clientSecretSent: process.env.CLOUDFLARE_OAUTH_USE_CLIENT_SECRET === "true",
    scopes: scopeString.split(/\s+/).filter(Boolean),
    scopeString,
    clientIdEnv: "CLOUDFLARE_OAUTH_CLIENT_ID",
    clientSecretEnv: "CLOUDFLARE_OAUTH_CLIENT_SECRET",
    publisherTxtEnv: "CLOUDFLARE_OAUTH_PUBLISHER_TXT",
    publisherVerificationTxt: cloudflareOauthPublisherTxt(),
    clientIdPresent: Boolean(cloudflareOauthClientId()),
    clientSecretPresent: Boolean(cloudflareOauthClientSecret()),
    localRuntimeFile: localSecretsPath,
  };
}

function resolveBin(name) {
  const extension = process.platform === "win32" ? ".CMD" : "";
  const local = resolve(root, "node_modules", ".bin", `${name}${extension}`);
  return existsSync(local) ? local : name;
}

function deleteEnvKey(env, key) {
  const target = key.toLowerCase();
  for (const existing of Object.keys(env)) {
    if (existing.toLowerCase() === target) delete env[existing];
  }
}

function mergeEnv(baseEnv, extraEnv = {}) {
  const env = { ...baseEnv };
  for (const [key, value] of Object.entries(extraEnv)) {
    if (value === null || value === undefined) {
      deleteEnvKey(env, key);
      continue;
    }
    env[key] = value;
  }
  return env;
}

function runNode(args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: childEnv(options),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => resolvePromise({ code, stdout, stderr }));
  });
}

function runCommand(command, args, options = {}) {
  const { input = "", extraEnv = {}, timeoutMs = 15000 } = options;
  return new Promise((resolvePromise) => {
    const useShell = process.platform === "win32" && /\.cmd$/i.test(command);
    const child = spawn(command, args, {
      cwd: root,
      env: mergeEnv(process.env, extraEnv),
      shell: useShell,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      resolvePromise({ code: 124, stdout, stderr: `${stderr}\nCommand timed out.`.trim() });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolvePromise({ code, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

function quoteCmdArg(value) {
  const stringValue = String(value);
  if (/^[A-Za-z0-9_:/=.,@+-]+$/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '\\"')}"`;
}

function runAgentCli(command, args, options = {}) {
  if (process.platform !== "win32") return runCommand(command, args, options);
  const commandLine = [command, ...args].map(quoteCmdArg).join(" ");
  return runCommand("cmd", ["/d", "/s", "/c", commandLine], options);
}

function wranglerSsoEnv() {
  return {
    CLOUDFLARE_API_TOKEN: null,
    CLOUDFLARE_SYNC_AUTH_TOKEN: null,
    CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN: null,
  };
}

async function wranglerStatus() {
  const wrangler = resolveBin("wrangler");
  const result = await runCommand(wrangler, ["whoami"], { extraEnv: wranglerSsoEnv(), timeoutMs: 20000 });
  return {
    authenticated: result.code === 0,
    code: result.code,
    summary: result.code === 0 ? "Wrangler SSO ready" : "Wrangler SSO not connected",
  };
}

async function githubStatus() {
  const gh = resolveBin("gh");
  const result = await runCommand(gh, ["auth", "status", "-h", "github.com"], { timeoutMs: 15000 });
  return {
    authenticated: result.code === 0,
    code: result.code,
    summary: result.code === 0 ? "GitHub CLI ready" : "GitHub CLI not connected",
  };
}

async function agentSetupStatus() {
  const [prompt, npx, codex, claude] = await Promise.all([
    fetchAgentPrompt().catch((error) => ({
      ok: false,
      status: 0,
      url: cloudflareAgentPromptUrl,
      error: error instanceof Error ? error.message : String(error),
    })),
    commandStatus("npx"),
    commandStatus("codex"),
    commandStatus("claude"),
  ]);
  return {
    prompt,
    servers: cloudflareMcpServers,
    commands: { npx, codex, claude },
    configs: [
      inspectAgentConfig(resolve(root, ".mcp.json"), "mcpServers"),
      inspectAgentConfig(resolve(root, ".vscode", "mcp.json"), "servers"),
      inspectAgentConfig(resolve(root, ".cursor", "mcp.json"), "mcpServers"),
    ],
  };
}

async function cloudflareAgentAccessStatus() {
  const result = await runNode([cloudflareAgentAccessScript, "--json"]);
  let report = null;
  try {
    report = JSON.parse(result.stdout || "{}");
  } catch {
    report = null;
  }
  return {
    ok: result.code === 0,
    code: result.code,
    report,
    stderr: result.stderr,
  };
}

async function installCloudflareSkills() {
  return runAgentCli(
    "npx",
    ["-y", "skills", "add", "cloudflare/skills", "--skill", "*", "--yes", "--global"],
    { timeoutMs: 240000 },
  );
}

async function configureCodexMcp() {
  const results = [];
  for (const server of cloudflareMcpServers) {
    const result = await runAgentCli("codex", ["mcp", "add", server.name, "--url", server.url], { timeoutMs: 60000 });
    results.push({ server: server.name, code: result.code, stdout: result.stdout, stderr: result.stderr });
    if (result.code !== 0) break;
  }
  return results;
}

async function codexCloudflareLogin() {
  return runAgentCli("codex", ["mcp", "login", "cloudflare"], { timeoutMs: 180000 });
}

function startWranglerLogin() {
  const wrangler = resolveBin("wrangler");
  const useShell = process.platform === "win32" && /\.cmd$/i.test(wrangler);
  const child = spawn(wrangler, ["login", "--use-keyring", "--callback-host", "127.0.0.1"], {
    cwd: root,
    env: mergeEnv(process.env, wranglerSsoEnv()),
    detached: true,
    shell: useShell,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return child.pid;
}

async function verifyCloudflare() {
  const token = cloudflareAuthToken();
  if (!token) return { connected: false, reason: "missing-token" };
  return verifyCloudflareToken(token);
}

async function verifyCloudflareToken(token) {
  const response = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
    headers: { Authorization: `Bearer ${token}` },
  }).catch((error) => ({ ok: false, status: 0, error }));
  if (!response.ok) return { connected: false, status: response.status };
  const data = await response.json();
  return { connected: Boolean(data.success), status: data.result?.status ?? "unknown" };
}

async function listKvNamespaces() {
  const token = cloudflareAuthToken();
  const accountId = cloudflareAccountId();
  if (!token || !accountId) {
    return { ok: false, error: "Cloudflare token and account id are required." };
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces?per_page=100`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    return { ok: false, status: response.status, error: data.errors?.[0]?.message ?? "Unable to list KV namespaces." };
  }
  return {
    ok: true,
    namespaces: (data.result ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      supportsUrlEncoding: true,
    })),
  };
}

async function handleCloudflareOauthStart(req, res, port) {
  const body = await readBody(req);
  const clientId = body.clientId || cloudflareOauthClientId();
  if (!clientId) {
    return json(res, 409, {
      error: "CLOUDFLARE_OAUTH_CLIENT_ID is required for OAuth PKCE.",
      config: cloudflareOauthConfig(port),
      fallback: "Create a Cloudflare OAuth client with the setup values shown in the app, save its Client ID, or use Wrangler SSO/token fallback.",
    });
  }

  const redirectUri = `http://127.0.0.1:${port}/oauth/cloudflare/callback`;
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(24));
  const scope = body.scope || cloudflareOauthScopes();

  session.cloudflareOauth = { verifier, state, redirectUri, clientId };
  const url = new URL(cloudflareAuthorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  openUrl(url.toString());
  return json(res, 200, { authorizationUrl: url.toString(), redirectUri, scope });
}

async function handleCloudflareOauthSaveClient(req, res) {
  const body = await readBody(req);
  const updates = {};
  if (typeof body.clientId === "string" && body.clientId.trim()) {
    updates.CLOUDFLARE_OAUTH_CLIENT_ID = body.clientId.trim();
  }
  if (typeof body.clientSecret === "string" && body.clientSecret.trim()) {
    updates.CLOUDFLARE_OAUTH_CLIENT_SECRET = body.clientSecret.trim();
  }
  if (typeof body.publisherTxt === "string" && body.publisherTxt.trim()) {
    updates.CLOUDFLARE_OAUTH_PUBLISHER_TXT = body.publisherTxt.trim();
  }
  const savedKeys = writeLocalSecrets(updates);
  if (savedKeys.length === 0) return json(res, 400, { ok: false, error: "No OAuth values were provided." });
  return json(res, 200, { ok: true, savedKeys });
}

async function handleCloudflareCallback(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !session.cloudflareOauth || state !== session.cloudflareOauth.state) {
    return text(res, 400, "Cloudflare OAuth callback state did not match.");
  }
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: session.cloudflareOauth.redirectUri,
    client_id: session.cloudflareOauth.clientId,
    code_verifier: session.cloudflareOauth.verifier,
  });
  const clientSecret = cloudflareOauthClientSecret();
  if (clientSecret && process.env.CLOUDFLARE_OAUTH_USE_CLIENT_SECRET === "true") {
    params.set("client_secret", clientSecret);
  }
  const response = await fetch(cloudflareTokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: params,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    return text(res, 502, "Cloudflare OAuth token exchange failed. Return to the sync app and use token fallback if needed.");
  }
  session.cloudflareAuthToken = data.access_token;
  return text(res, 200, "<h1>Cloudflare connected</h1><p>You can close this tab and return to GoldShore Secret Sync.</p>", "text/html; charset=utf-8");
}

async function handleGithubDeviceStart(req, res) {
  const body = await readBody(req);
  const clientId = body.clientId || githubOauthClientId();
  if (!clientId) {
    return json(res, 409, {
      error: "GITHUB_OAUTH_CLIENT_ID is required for GitHub device OAuth.",
      fallback: "Use GH_TOKEN/GITHUB_TOKEN, paste a token into the local form, or run gh auth login --web.",
    });
  }
  const scope = body.scope || process.env.GITHUB_OAUTH_SCOPES || "repo admin:org";
  const response = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, scope }),
  });
  const data = await response.json();
  if (!response.ok || data.error) return json(res, 502, { error: data.error_description || "Unable to start GitHub device flow." });
  session.githubDevice = {
    clientId,
    deviceCode: data.device_code,
    interval: Number(data.interval || 5),
    expiresAt: Date.now() + Number(data.expires_in || 900) * 1000,
  };
  openUrl(data.verification_uri);
  return json(res, 200, {
    verificationUri: data.verification_uri,
    userCode: data.user_code,
    expiresIn: data.expires_in,
    interval: data.interval,
  });
}

async function handleGithubDevicePoll(req, res) {
  if (!session.githubDevice) return json(res, 400, { error: "GitHub device flow has not been started." });
  if (Date.now() > session.githubDevice.expiresAt) return json(res, 410, { error: "GitHub device flow expired." });
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: session.githubDevice.clientId,
      device_code: session.githubDevice.deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });
  const data = await response.json();
  if (data.error) {
    if (data.error === "slow_down") session.githubDevice.interval += 5;
    if (data.error === "expired_token" || data.error === "access_denied") {
      session.githubDevice = null;
      return json(res, 410, { pending: false, error: data.error });
    }
    const status = data.error === "authorization_pending" || data.error === "slow_down" ? 202 : 400;
    return json(res, status, { pending: status === 202, error: data.error, interval: session.githubDevice.interval });
  }
  if (!data.access_token) return json(res, 502, { error: "GitHub did not return an access token." });
  session.githubToken = data.access_token;
  return json(res, 200, { connected: true, scope: data.scope ?? "" });
}

async function handleGithubOauthSaveClient(req, res) {
  const body = await readBody(req);
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  if (!clientId) return json(res, 400, { ok: false, error: "GITHUB_OAUTH_CLIENT_ID is required." });
  const savedKeys = writeLocalSecrets({ GITHUB_OAUTH_CLIENT_ID: clientId });
  return json(res, 200, { ok: true, savedKeys });
}

async function handlePlan(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  const args = [syncScript, "audit", "--json"];
  if (url.searchParams.get("allowKvSource") === "true") args.push("--allow-kv-source");
  if (url.searchParams.get("strict") === "true") args.push("--strict");
  if (url.searchParams.get("fingerprints") === "true") args.push("--fingerprints");
  const result = await runNode(args);
  if (result.code !== 0) {
    return json(res, 422, { ok: false, stdout: result.stdout, stderr: result.stderr });
  }
  return text(res, 200, result.stdout, "application/json; charset=utf-8");
}

async function handleApply(req, res) {
  const body = await readBody(req);
  if (body.confirm !== "APPLY") return json(res, 400, { error: "Type APPLY to run a write sync." });
  const runOptions = { githubAuth: body.githubAuth || "cli" };
  const buildArgs = (dryRun, options = {}) => {
    const args = [syncScript, "apply"];
    if (body.allowKvSource !== false) args.push("--allow-kv-source");
    if (body.strict !== false) args.push("--strict");
    if (dryRun) args.push("--dry-run");
    if (options.validateAuth) args.push("--validate-auth");
    if (body.cloudflareAuth) args.push("--cloudflare-auth", body.cloudflareAuth);
    if (body.githubAuth) args.push("--github-auth", body.githubAuth);
    return args;
  };
  if (!body.dryRun && body.preflight !== false) {
    const preflight = await runNode(buildArgs(true, { validateAuth: true }), runOptions);
    if (preflight.code !== 0) {
      return json(res, 422, {
        ok: false,
        phase: "preflight",
        code: preflight.code,
        stdout: preflight.stdout,
        stderr: preflight.stderr,
      });
    }
  }
  const args = buildArgs(Boolean(body.dryRun));
  const result = await runNode(args, runOptions);
  return json(res, result.code === 0 ? 200 : 422, {
    ok: result.code === 0,
    phase: body.dryRun ? "dry-run" : "apply",
    code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
  });
}

async function route(req, res, port) {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  try {
    if (req.method === "GET" && url.pathname === "/") {
      if (!existsSync(uiPath)) return text(res, 500, `Missing UI file: ${uiPath}`);
      return text(res, 200, readFileSync(uiPath, "utf8"), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && url.pathname === "/api/state") {
      const cloudflareWrangler = await wranglerStatus();
      const githubCli = await githubStatus();
      return json(res, 200, {
        repoRoot: root,
        manifest: "infra/secrets/secret-sync.manifest.yaml",
        cloudflare: {
          accountIdPresent: Boolean(cloudflareAccountId()),
          authTokenPresent: Boolean(cloudflareAuthToken()),
          oauthClientConfigured: Boolean(cloudflareOauthClientId()),
          oauth: cloudflareOauthConfig(port),
          wranglerSso: cloudflareWrangler,
          verify: await verifyCloudflare(),
        },
        github: {
          tokenPresent: Boolean(session.githubToken || process.env.GH_TOKEN || process.env.GITHUB_TOKEN) || githubCli.authenticated,
          oauthClientConfigured: Boolean(githubOauthClientId()),
          cli: githubCli,
        },
        localPersistence: {
          filePresent: existsSync(localSecretsPath),
          path: localSecretsPath,
          keys: Object.keys(readLocalSecrets()).sort(),
        },
      });
    }
    if (req.method === "POST" && url.pathname === "/api/cloudflare/token") {
      const body = await readBody(req);
      const nextToken = typeof body.token === "string" ? body.token.trim() : "";
      const nextAccountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
      const verified = nextToken ? await verifyCloudflareToken(nextToken) : null;
      if (nextToken && (!verified.connected || verified.status !== "active")) {
        return json(res, 422, {
          ok: false,
          error: "Cloudflare token verification failed. Existing local token values were not overwritten.",
          verify: verified,
        });
      }
      if (nextToken) session.cloudflareAuthToken = nextToken;
      if (nextAccountId) session.cloudflareAccountId = nextAccountId;
      const savedValues = {
        CLOUDFLARE_ACCOUNT_ID: session.cloudflareAccountId,
      };
      if (nextToken) {
        savedValues.CLOUDFLARE_SYNC_AUTH_TOKEN = session.cloudflareAuthToken;
        savedValues.CLOUDFLARE_API_TOKEN = session.cloudflareAuthToken;
        if (body.syncDeployToken) savedValues.CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN = session.cloudflareAuthToken;
      }
      const savedKeys = body.remember ? writeLocalSecrets(savedValues) : [];
      return json(res, 200, {
        ok: true,
        tokenVerified: Boolean(verified?.connected),
        tokenStatus: verified?.status ?? null,
        tokenStoredInMemory: Boolean(session.cloudflareAuthToken),
        accountIdPresent: Boolean(session.cloudflareAccountId),
        savedKeys,
      });
    }
    if (req.method === "POST" && url.pathname === "/api/source-values") {
      const body = await readBody(req);
      const values = body.values && typeof body.values === "object" ? body.values : {};
      const savedKeys = writeLocalSecrets(values);
      const refreshed = readLocalSecrets();
      session.cloudflareAuthToken = session.cloudflareAuthToken || refreshed.CLOUDFLARE_SYNC_AUTH_TOKEN || "";
      session.cloudflareAccountId = session.cloudflareAccountId || refreshed.CLOUDFLARE_ACCOUNT_ID || "";
      session.githubToken = session.githubToken || refreshed.GH_TOKEN || refreshed.GITHUB_TOKEN || "";
      return json(res, 200, { ok: true, savedKeys });
    }
    if (req.method === "POST" && url.pathname === "/api/source-values/generate-internal") {
      const body = await readBody(req);
      const requested = Array.isArray(body.keys) ? body.keys : ["CONTROL_SYNC_TOKEN", "JWT_SECRET"];
      const values = {};
      const skipped = [];
      for (const key of requested) {
        try {
          values[key] = generateInternalSecret(key);
        } catch (error) {
          skipped.push({ key, reason: error instanceof Error ? error.message : String(error) });
        }
      }
      const savedKeys = writeLocalSecrets(values);
      return json(res, 200, { ok: true, savedKeys, skipped });
    }
    if (req.method === "POST" && url.pathname === "/api/cloudflare/sso/start") {
      const status = await wranglerStatus();
      if (status.authenticated) {
        return json(res, 200, {
          ok: true,
          alreadyAuthenticated: true,
          message: "Wrangler Cloudflare SSO is already ready. No login window was started.",
        });
      }
      const pid = startWranglerLogin();
      return json(res, 200, {
        ok: true,
        pid,
        message: "Wrangler Cloudflare SSO started. Finish the browser login, then refresh or run SSO Auto-Apply.",
      });
    }
    if (req.method === "GET" && url.pathname === "/api/cloudflare/sso/status") return json(res, 200, await wranglerStatus());
    if (req.method === "GET" && url.pathname === "/api/cloudflare/oauth/config") return json(res, 200, cloudflareOauthConfig(port));
    if (req.method === "POST" && url.pathname === "/api/cloudflare/oauth/save-client") return handleCloudflareOauthSaveClient(req, res);
    if (req.method === "GET" && url.pathname === "/api/cloudflare/agent-access") {
      const result = await cloudflareAgentAccessStatus();
      return json(res, result.ok ? 200 : 422, result);
    }
    if (req.method === "GET" && url.pathname === "/api/agent-setup/status") return json(res, 200, await agentSetupStatus());
    if (req.method === "POST" && url.pathname === "/api/agent-setup/sync-configs") {
      return json(res, 200, { ok: true, results: syncAgentConfigs() });
    }
    if (req.method === "POST" && url.pathname === "/api/agent-setup/install-skills") {
      const result = await installCloudflareSkills();
      return json(res, result.code === 0 ? 200 : 422, { ok: result.code === 0, ...result });
    }
    if (req.method === "POST" && url.pathname === "/api/agent-setup/codex-mcp") {
      const results = await configureCodexMcp();
      return json(res, results.every((result) => result.code === 0) ? 200 : 422, {
        ok: results.every((result) => result.code === 0),
        results,
      });
    }
    if (req.method === "POST" && url.pathname === "/api/agent-setup/codex-login") {
      const result = await codexCloudflareLogin();
      return json(res, result.code === 0 ? 200 : 422, { ok: result.code === 0, ...result });
    }
    if (req.method === "POST" && url.pathname === "/api/cloudflare/oauth/start") return handleCloudflareOauthStart(req, res, port);
    if (req.method === "GET" && url.pathname === "/oauth/cloudflare/callback") return handleCloudflareCallback(req, res);
    if (req.method === "POST" && url.pathname === "/api/github/token") {
      const body = await readBody(req);
      if (typeof body.token === "string" && body.token.length > 0) session.githubToken = body.token;
      const savedKeys = body.remember ? writeLocalSecrets({ GH_TOKEN: session.githubToken }) : [];
      return json(res, 200, { ok: true, tokenStoredInMemory: Boolean(session.githubToken), savedKeys });
    }
    if (req.method === "POST" && url.pathname === "/api/github/oauth/save-client") return handleGithubOauthSaveClient(req, res);
    if (req.method === "POST" && url.pathname === "/api/github/device/start") return handleGithubDeviceStart(req, res);
    if (req.method === "POST" && url.pathname === "/api/github/device/poll") return handleGithubDevicePoll(req, res);
    if (req.method === "GET" && url.pathname === "/api/kv/namespaces") return json(res, 200, await listKvNamespaces());
    if (req.method === "GET" && url.pathname === "/api/plan") return handlePlan(req, res);
    if (req.method === "POST" && url.pathname === "/api/apply") return handleApply(req, res);
    return json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error("Unhandled route error:", error);
    return json(res, 500, { error: "Internal server error" });
  }
}

function start(port) {
  const server = createServer((req, res) => {
    void route(req, res, port);
  });
  server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`GoldShore Secret Sync app running at ${url}`);
    openUrl(url);
  });
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && port < defaultPort + 20) return start(port + 1);
    console.error(error);
    process.exit(1);
  });
}

start(defaultPort);
