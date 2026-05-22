import fs from 'node:fs';
import path from 'node:path';

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const normalized = trimmed.startsWith('export ')
    ? trimmed.slice('export '.length).trim()
    : trimmed;

  const separatorIndex = normalized.indexOf('=');
  if (separatorIndex === -1) {
    return null;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  const rawValue = normalized.slice(separatorIndex + 1).trim();
  const value = rawValue.replace(/^(["'])(.*)\1$/, '$2');

  if (!key) {
    return null;
  }

  return { key, value };
}

function applyEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

export function loadGatewayEnv({ cwd = process.cwd() } = {}) {
  const envFiles = ['.env', '.dev.vars'];

  for (const file of envFiles) {
    applyEnvFile(path.join(cwd, file));
  }
}

export const _test = { parseEnvLine };
