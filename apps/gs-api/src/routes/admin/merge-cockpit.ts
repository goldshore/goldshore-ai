import { Hono } from 'hono';
import { getActor, logAdminAction, requirePermission } from '../../auth';
import type { Env, Variables } from '../../types';
import {
  buildConflictFiles,
  checksAreGreen,
  isSha,
  validateResolutions,
  type MergeCheck,
} from '../../lib/merge-cockpit';

const OWNER = 'marzton';
const REPO = 'goldshore-ai';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const WORKFLOW = 'admin-merge-cockpit.yml';

type GitHubPull = {
  number: number;
  title: string;
  html_url: string;
  draft: boolean;
  mergeable: boolean | null;
  mergeable_state: string;
  merged: boolean;
  updated_at: string;
  user: { login: string };
  base: { ref: string; sha: string };
  head: { ref: string; sha: string; repo: { full_name: string } | null };
};

type CompareResponse = {
  merge_base_commit: { sha: string };
  files?: Array<{ filename: string }>;
};

const cockpit = new Hono<{ Bindings: Env; Variables: Variables }>();

const tokenFor = (env: Env) => env.GITHUB_API_TOKEN ?? env.GITHUB_TOKEN ?? env.GH_TOKEN;

const github = async <T>(env: Env, path: string, init: RequestInit = {}): Promise<T> => {
  const token = tokenFor(env);
  if (!token) throw new Error('GITHUB_API_TOKEN is not configured.');
  const response = await fetch(path.startsWith('https://') ? path : `${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'goldshore-merge-cockpit',
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub ${response.status}: ${detail.slice(0, 500)}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

const pullDetail = async (env: Env, number: number) => {
  const pull = await github<GitHubPull>(env, `/pulls/${number}`);
  const baseRef = await github<{ object: { sha: string } }>(env, `/git/ref/heads/${encodeURIComponent(pull.base.ref)}`);
  const currentBaseSha = baseRef.object.sha;
  const comparison = await github<CompareResponse>(env, `/compare/${currentBaseSha}...${pull.head.sha}`);
  const mergeBaseSha = comparison.merge_base_commit.sha;
  const [currentComparison, incomingComparison, checkRuns, combinedStatus] = await Promise.all([
    github<CompareResponse>(env, `/compare/${mergeBaseSha}...${currentBaseSha}`),
    github<CompareResponse>(env, `/compare/${mergeBaseSha}...${pull.head.sha}`),
    github<{ check_runs: Array<{ name: string; status: string; conclusion: string | null; html_url?: string }> }>(
      env, `/commits/${pull.head.sha}/check-runs?per_page=100`,
    ),
    github<{ statuses: Array<{ context: string; state: string; target_url?: string }> }>(
      env, `/commits/${pull.head.sha}/status`,
    ),
  ]);
  const files = buildConflictFiles(
    (currentComparison.files ?? []).map((file) => file.filename),
    (incomingComparison.files ?? []).map((file) => file.filename),
  );
  const checks: MergeCheck[] = [
    ...checkRuns.check_runs.map((check) => ({
      name: check.name,
      status: check.status,
      conclusion: check.conclusion,
      url: check.html_url,
    })),
    ...combinedStatus.statuses.map((status) => ({
      name: status.context,
      status: 'completed',
      conclusion: status.state === 'success' ? 'success' : status.state,
      url: status.target_url,
    })),
  ];
  const semanticConflicts = files.filter((file) => file.semanticConflict);
  const green = checksAreGreen(checks);
  const cloudflareGreen = checks.some((check) =>
    /cloudflare/i.test(check.name) && check.status === 'completed' &&
    ['success', 'neutral', 'skipped'].includes(check.conclusion ?? '')
  );
  return {
    pull,
    mergeBaseSha,
    currentBaseSha,
    files,
    semanticConflicts,
    checks,
    checksGreen: green,
    cloudflareGreen,
    directMergeEligible:
      !pull.draft && !pull.merged && pull.base.ref === 'main' && pull.mergeable === true &&
      pull.mergeable_state === 'clean' && semanticConflicts.length === 0 && green && cloudflareGreen,
  };
};

cockpit.get('/pulls', requirePermission('github:read'), async (c) => {
  try {
    const pulls = await github<GitHubPull[]>(c.env, '/pulls?state=open&sort=updated&direction=desc&per_page=50');
    return c.json({
      pulls: pulls.map((pull) => ({
        number: pull.number,
        title: pull.title,
        url: pull.html_url,
        author: pull.user.login,
        draft: pull.draft,
        updatedAt: pull.updated_at,
        base: pull.base,
        head: { ref: pull.head.ref, sha: pull.head.sha },
      })),
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'GitHub request failed.' }, 502);
  }
});

cockpit.get('/pulls/:number', requirePermission('github:read'), async (c) => {
  const number = Number(c.req.param('number'));
  if (!Number.isInteger(number) || number < 1) return c.json({ error: 'Invalid pull request number.' }, 400);
  try {
    return c.json(await pullDetail(c.env, number));
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'GitHub request failed.' }, 502);
  }
});

cockpit.get('/pulls/:number/file', requirePermission('github:read'), async (c) => {
  const number = Number(c.req.param('number'));
  const filename = c.req.query('path') ?? '';
  const version = c.req.query('version');
  if (!Number.isInteger(number) || !filename || !['base', 'current', 'incoming'].includes(version ?? '')) {
    return c.json({ error: 'A valid pull request, path, and version are required.' }, 400);
  }
  try {
    const detail = await pullDetail(c.env, number);
    if (!detail.files.some((file) => file.filename === filename)) return c.json({ error: 'File is outside this PR comparison.' }, 404);
    const ref = version === 'base' ? detail.mergeBaseSha : version === 'current' ? detail.currentBaseSha : detail.pull.head.sha;
    const url = `${API}/contents/${filename.split('/').map(encodeURIComponent).join('/')}?ref=${ref}`;
    const content = await github<{ content: string; encoding: string }>(c.env, url);
    if (content.encoding !== 'base64') return c.json({ error: 'Unsupported GitHub content encoding.' }, 502);
    const bytes = Uint8Array.from(atob(content.content.replace(/\s/g, '')), (character) => character.charCodeAt(0));
    return c.json({ filename, version, ref, content: new TextDecoder().decode(bytes) });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'GitHub request failed.' }, 502);
  }
});

cockpit.post('/salvage', requirePermission('github:manage'), async (c) => {
  const payload = await c.req.json<{
    prNumber?: number; expectedBaseSha?: string; expectedHeadSha?: string;
    resolutions?: Record<string, string>;
  }>().catch(() => null);
  if (!payload || !Number.isInteger(payload.prNumber) || !isSha(payload.expectedBaseSha) || !isSha(payload.expectedHeadSha)) {
    return c.json({ error: 'PR number and full expected base/head SHAs are required.' }, 400);
  }
  try {
    const detail = await pullDetail(c.env, payload.prNumber!);
    if (detail.currentBaseSha !== payload.expectedBaseSha || detail.pull.head.sha !== payload.expectedHeadSha) {
      return c.json({ error: 'PR state changed. Refresh the cockpit before continuing.' }, 409);
    }
    const conflicts = detail.semanticConflicts.map((file) => file.filename);
    const resolutions = validateResolutions(payload.resolutions, conflicts);
    if (!resolutions || conflicts.some((file) => !resolutions[file] || resolutions[file] === 'defer')) {
      return c.json({ error: 'Every semantic conflict must be resolved to current or incoming.' }, 400);
    }
    await github<void>(c.env, `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          pr_number: String(payload.prNumber),
          expected_base_sha: payload.expectedBaseSha,
          expected_head_sha: payload.expectedHeadSha,
          resolutions_json: JSON.stringify(resolutions),
        },
      }),
    });
    await logAdminAction(c.env, {
      action: 'admin.merge-cockpit.salvage.dispatch',
      actor: getActor(c.get('accessClaims'), c.req.raw), status: 'success',
      metadata: { prNumber: payload.prNumber, baseSha: payload.expectedBaseSha, headSha: payload.expectedHeadSha },
    });
    return c.json({ accepted: true, message: 'SHA-locked salvage workflow dispatched.' }, 202);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Salvage dispatch failed.' }, 502);
  }
});

cockpit.post('/merge', requirePermission('github:manage'), async (c) => {
  const payload = await c.req.json<{
    prNumber?: number; expectedBaseSha?: string; expectedHeadSha?: string; confirmation?: string;
  }>().catch(() => null);
  if (!payload || !Number.isInteger(payload.prNumber) || !isSha(payload.expectedBaseSha) ||
      !isSha(payload.expectedHeadSha) || payload.confirmation !== `SQUASH #${payload.prNumber}`) {
    return c.json({ error: 'Expected SHAs and exact squash confirmation are required.' }, 400);
  }
  try {
    const detail = await pullDetail(c.env, payload.prNumber!);
    if (detail.currentBaseSha !== payload.expectedBaseSha || detail.pull.head.sha !== payload.expectedHeadSha) {
      return c.json({ error: 'PR state changed. Refresh the cockpit before continuing.' }, 409);
    }
    if (!detail.directMergeEligible) return c.json({ error: 'Direct merge is blocked. Use a salvage PR or wait for every check.' }, 409);
    const result = await github<{ merged: boolean; message: string; sha: string }>(c.env, `/pulls/${payload.prNumber}/merge`, {
      method: 'PUT',
      body: JSON.stringify({ sha: payload.expectedHeadSha, merge_method: 'squash' }),
    });
    await logAdminAction(c.env, {
      action: 'admin.merge-cockpit.squash', actor: getActor(c.get('accessClaims'), c.req.raw),
      status: result.merged ? 'success' : 'error', metadata: { prNumber: payload.prNumber, sha: result.sha },
    });
    return c.json(result, result.merged ? 200 : 409);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Merge failed.' }, 502);
  }
});

export default cockpit;
