export type MergeCockpitFile = {
  filename: string;
  currentChanged: boolean;
  incomingChanged: boolean;
  semanticConflict: boolean;
  risk: 'critical' | 'high' | 'normal';
};

const CRITICAL_PATHS = [
  /^\.github\/workflows\//,
  /^apps\/[^/]+\/wrangler\.(?:toml|jsonc)$/,
  /(?:^|\/)migrations\//,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
  /^AGENTS\.md$/,
];

const HIGH_RISK_PATHS = [
  /^apps\/gs-api\/src\/(?:index|auth|types)\.ts$/,
  /^apps\/gs-web\/src\/(?:middleware|utils\/admin-access)\.ts$/,
  /^infra\/Cloudflare\//,
  /(?:^|\/)routes\//,
];

export const classifyMergeRisk = (filename: string): MergeCockpitFile['risk'] => {
  if (CRITICAL_PATHS.some((pattern) => pattern.test(filename))) return 'critical';
  if (HIGH_RISK_PATHS.some((pattern) => pattern.test(filename))) return 'high';
  return 'normal';
};

export const buildConflictFiles = (currentFiles: string[], incomingFiles: string[]) => {
  const current = new Set(currentFiles);
  const incoming = new Set(incomingFiles);
  return [...new Set([...currentFiles, ...incomingFiles])]
    .sort()
    .map<MergeCockpitFile>((filename) => ({
      filename,
      currentChanged: current.has(filename),
      incomingChanged: incoming.has(filename),
      semanticConflict: current.has(filename) && incoming.has(filename),
      risk: classifyMergeRisk(filename),
    }));
};

export type MergeCheck = {
  name: string;
  status: string;
  conclusion: string | null;
  url?: string | null;
};

export const checksAreGreen = (checks: MergeCheck[]) =>
  checks.length > 0 && checks.every((check) =>
    check.status === 'completed' && ['success', 'neutral', 'skipped'].includes(check.conclusion ?? '')
  );

export const isSha = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);

export const validateResolutions = (value: unknown, allowedFiles: string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const allowed = new Set(allowedFiles);
  const result: Record<string, 'current' | 'incoming' | 'defer'> = {};
  for (const [filename, resolution] of Object.entries(value)) {
    if (!allowed.has(filename) || !['current', 'incoming', 'defer'].includes(String(resolution))) return null;
    result[filename] = resolution as 'current' | 'incoming' | 'defer';
  }
  return result;
};
