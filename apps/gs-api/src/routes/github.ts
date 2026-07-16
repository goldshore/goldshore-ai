import { Hono } from 'hono';
import type { Env, Variables } from '../types';

type GitHubStatusState = 'error' | 'failure' | 'pending' | 'success';

type GitHubWebhookContext = {
  event: string;
  delivery: string;
  action: string;
  repository: string;
  sha: string;
  ref: string;
  sender: string;
  defaultBranch: string;
  receivedAt: string;
};

type HookResult = {
  url: string;
  ok: boolean;
  status: number;
};

const github = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

const textEncoder = new TextEncoder();
const DEFAULT_ALLOWED_EVENTS = new Set([
  'deployment_status',
  'ping',
  'pull_request',
  'push',
  'workflow_run',
]);

const jsonHeaders = {
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'User-Agent': 'goldshore-github-webhook-gateway',
  'X-GitHub-Api-Version': '2022-11-28',
};

function normalizeSecret(value?: string) {
  return (value ?? '').trim();
}

function githubWebhookSecret(env: Env) {
  return normalizeSecret(env.GITHUB_WEBHOOK_SECRET || env.GH_WEBHOOK_SECRET);
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

async function verifyGitHubSignature(secret: string, body: string, signatureHeader: string) {
  if (!signatureHeader.startsWith('sha256=')) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(body));
  const expected = `sha256=${bytesToHex(new Uint8Array(signature))}`;

  return timingSafeEqual(expected, signatureHeader);
}

function parseAllowedEvents(env: Env) {
  const configured = (env.GITHUB_WEBHOOK_ALLOWED_EVENTS ?? '')
    .split(',')
    .map((event) => event.trim())
    .filter(Boolean);
  return configured.length > 0 ? new Set(configured) : DEFAULT_ALLOWED_EVENTS;
}

function webhookContext(event: string, delivery: string, payload: any): GitHubWebhookContext {
  const repository = String(payload.repository?.full_name ?? '');
  const defaultBranch = String(payload.repository?.default_branch ?? 'main');
  const pullRequest = payload.pull_request;
  const workflowRun = payload.workflow_run;
  const deployment = payload.deployment;
  const deploymentStatus = payload.deployment_status;

  return {
    event,
    delivery,
    action: String(payload.action ?? ''),
    repository,
    sha: String(
      pullRequest?.head?.sha ??
        workflowRun?.head_sha ??
        deploymentStatus?.deployment?.sha ??
        deployment?.sha ??
        payload.after ??
        payload.head_commit?.id ??
        '',
    ),
    ref: String(
      pullRequest?.head?.ref ??
        workflowRun?.head_branch ??
        deployment?.ref ??
        payload.ref ??
        '',
    ),
    sender: String(payload.sender?.login ?? ''),
    defaultBranch,
    receivedAt: new Date().toISOString(),
  };
}

function shouldRunPostDeployHooks(context: GitHubWebhookContext, payload: any) {
  if (context.event === 'push') {
    return context.ref === `refs/heads/${context.defaultBranch}`;
  }

  if (context.event === 'workflow_run') {
    return context.action === 'completed' && payload.workflow_run?.conclusion === 'success';
  }

  if (context.event === 'deployment_status') {
    return payload.deployment_status?.state === 'success';
  }

  return false;
}

async function recordWebhook(env: Env, context: GitHubWebhookContext, duplicate: boolean) {
  const namespace = env.CONTROL_LOGS || env.KV;
  if (!namespace) return;

  const entry = {
    ...context,
    duplicate,
  };

  await namespace.put(`github:webhook:event:${context.delivery}`, JSON.stringify(entry), {
    expirationTtl: 60 * 60 * 24 * 30,
  });
}

async function hasSeenDelivery(env: Env, delivery: string) {
  if (!delivery || !env.KV) return false;
  const key = `github:webhook:delivery:${delivery}`;
  const existing = await env.KV.get(key);
  if (existing) return true;
  await env.KV.put(key, '1', { expirationTtl: 60 * 60 * 24 });
  return false;
}

function configuredHookUrls(env: Env) {
  return (env.GITHUB_WEBHOOK_POST_DEPLOY_URLS ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

async function runPostDeployHooks(env: Env, context: GitHubWebhookContext): Promise<HookResult[]> {
  const token = normalizeSecret(env.GITHUB_WEBHOOK_POST_DEPLOY_TOKEN);
  const body = JSON.stringify({
    source: 'github',
    context,
  });

  const results: HookResult[] = [];
  for (const url of configuredHookUrls(env)) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });
    results.push({ url, ok: response.ok, status: response.status });
  }

  return results;
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToPkcs8(pem: string) {
  const normalized = pem.replace(/\\n/g, '\n');
  const isPkcs1Rsa = normalized.includes('-----BEGIN RSA PRIVATE KEY-----');
  const base64 = normalized
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return isPkcs1Rsa ? wrapRsaPkcs1AsPkcs8(bytes).buffer : bytes.buffer;
}

function wrapRsaPkcs1AsPkcs8(pkcs1Der: Uint8Array) {
  const version = derEncode(0x02, new Uint8Array([0]));
  const rsaEncryptionOid = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]);
  const nullParam = new Uint8Array([0x05, 0x00]);
  const algorithmIdentifier = derEncode(0x30, concatBytes(rsaEncryptionOid, nullParam));
  const privateKey = derEncode(0x04, pkcs1Der);
  return derEncode(0x30, concatBytes(version, algorithmIdentifier, privateKey));
}

function derEncode(tag: number, payload: Uint8Array) {
  return concatBytes(new Uint8Array([tag]), derLength(payload.length), payload);
}

function derLength(length: number) {
  if (length < 0x80) return new Uint8Array([length]);

  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function concatBytes(...parts: Uint8Array[]) {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }
  return combined;
}

async function createGitHubAppJwt(env: Env) {
  const appId = normalizeSecret(env.GITHUB_APP_ID);
  const privateKey = normalizeSecret(env.GITHUB_APP_PRIVATE_KEY);
  if (!appId || !privateKey) return '';

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(textEncoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64Url(
    textEncoder.encode(
      JSON.stringify({
        iat: now - 60,
        exp: now + 9 * 60,
        iss: appId,
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, textEncoder.encode(signingInput));
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

async function githubInstallationToken(env: Env) {
  if (env.GITHUB_STATUS_TOKEN) return env.GITHUB_STATUS_TOKEN;

  const installationId = normalizeSecret(env.GITHUB_APP_INSTALLATION_ID);
  const jwt = await createGitHubAppJwt(env);
  if (!installationId || !jwt) return '';

  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub installation token exchange failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { token?: string };
  return payload.token ?? '';
}

async function reportGitHubStatus(
  env: Env,
  context: GitHubWebhookContext,
  state: GitHubStatusState,
  description: string,
) {
  if (env.GITHUB_STATUS_REPORTING_DISABLED === '1') {
    return { ok: true, skipped: true, reason: 'disabled' };
  }
  if (!context.repository || !context.sha) {
    return { ok: true, skipped: true, reason: 'missing-repository-or-sha' };
  }

  const token = await githubInstallationToken(env);
  if (!token) {
    return { ok: true, skipped: true, reason: 'missing-github-status-credentials' };
  }

  const response = await fetch(`https://api.github.com/repos/${context.repository}/statuses/${context.sha}`, {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      state,
      description: description.slice(0, 140),
      context: env.GITHUB_STATUS_CONTEXT || 'goldshore/webhook-gateway',
      target_url: env.GITHUB_STATUS_TARGET_URL || 'https://api.goldshore.ai/health',
    }),
  });

  if (!response.ok) {
    return { ok: false, skipped: false, reason: `github-status-http-${response.status}` };
  }

  return { ok: true, skipped: false, reason: '' };
}

github.post('/github', async (c) => {
  const delivery = c.req.header('X-GitHub-Delivery') ?? '';
  const event = c.req.header('X-GitHub-Event') ?? '';
  const signature = c.req.header('X-Hub-Signature-256') ?? '';
  const secret = githubWebhookSecret(c.env);

  if (!secret) {
    return c.json({ ok: false, error: 'GitHub webhook secret is not configured.' }, 503);
  }

  if (!delivery || !event || !signature) {
    return c.json({ ok: false, error: 'Missing required GitHub webhook headers.' }, 400);
  }

  const rawBody = await c.req.raw.text();
  const valid = await verifyGitHubSignature(secret, rawBody, signature);
  if (!valid) {
    return c.json({ ok: false, error: 'Invalid GitHub webhook signature.' }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ ok: false, error: 'Invalid GitHub webhook JSON payload.' }, 400);
  }

  const duplicate = await hasSeenDelivery(c.env, delivery);
  const context = webhookContext(event, delivery, payload);
  await recordWebhook(c.env, context, duplicate);

  if (event === 'ping') {
    return c.json({ ok: true, event, delivery, duplicate, message: 'pong' });
  }

  if (!parseAllowedEvents(c.env).has(event)) {
    return c.json(
      {
        ok: true,
        event,
        delivery,
        duplicate,
        ignored: true,
        message: 'GitHub event recorded but not configured for deploy processing.',
      },
      202,
    );
  }

  if (duplicate) {
    return c.json({ ok: true, event, delivery, duplicate, message: 'Delivery already processed.' }, 202);
  }

  const shouldRunHooks = shouldRunPostDeployHooks(context, payload);
  const hookResults = shouldRunHooks ? await runPostDeployHooks(c.env, context) : [];
  const failedHooks = hookResults.filter((result) => !result.ok);
  const statusResult = await reportGitHubStatus(
    c.env,
    context,
    failedHooks.length > 0 ? 'failure' : 'success',
    failedHooks.length > 0
      ? `GoldShore webhook hooks failed for ${event}`
      : `GoldShore webhook accepted ${event}`,
  );

  return c.json(
    {
      ok: true,
      event,
      delivery,
      duplicate,
      repository: context.repository,
      sha: context.sha,
      postDeployHooks: hookResults,
      githubStatus: statusResult,
    },
    failedHooks.length > 0 || !statusResult.ok ? 202 : 200,
  );
});

export default github;
