#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const THEME_PACKAGE = '@goldshore/theme';
const REPO_ROOT = process.cwd();
const THEME_PACKAGE_JSON = join(REPO_ROOT, 'packages/theme/package.json');
const FILE_GLOBS = [
  "apps/**/*.astro",
  "apps/**/*.ts",
  "apps/**/*.tsx",
  "apps/**/*.js",
  "apps/**/*.jsx",
  "apps/**/*.mjs",
  "apps/**/*.mts",
  "packages/**/*.astro",
  "packages/**/*.ts",
  "packages/**/*.tsx",
  "packages/**/*.js",
  "packages/**/*.jsx",
  "packages/**/*.mjs",
  "packages/**/*.mts",
  "scripts/**/*.ts",
  "scripts/**/*.js",
  "scripts/**/*.mjs",
];

function loadExports() {
  const pkg = JSON.parse(readFileSync(THEME_PACKAGE_JSON, 'utf8'));
  const exportsField = pkg.exports ?? {};
  return Object.keys(exportsField).filter((key) => typeof exportsField[key] === 'string');
}

function toRegex(exportKey) {
  if (exportKey === '.') return /^\.$/;
  const escaped = exportKey.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

function getFiles() {
  const globArgs = FILE_GLOBS.map((glob) => `'${glob}'`).join(' ');
  const output = execSync(`git ls-files ${globArgs}`, { encoding: 'utf8' });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !file.includes('/dist/') && !file.includes('/node_modules/'));
}

function getThemeSpecifiers(content) {
  const matches = [];
  const regex = /(?:import|export)\s+(?:[^'"`]*?\s+from\s+)?['"](@goldshore\/theme(?:\/[^'"`]+)?)['"]|import\(\s*['"](@goldshore\/theme(?:\/[^'"`]+)?)['"]\s*\)/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const specifier = match[1] ?? match[2];
    if (specifier) matches.push(specifier);
  }

  return [...new Set(matches)];
}

function toSubpath(specifier) {
  if (specifier === THEME_PACKAGE) return '.';
  if (!specifier.startsWith(`${THEME_PACKAGE}/`)) return null;
  return `./${specifier.slice(`${THEME_PACKAGE}/`.length)}`;
}

function main() {
  const exportKeys = loadExports();
  const exportMatchers = exportKeys.map((key) => ({ key, regex: toRegex(key) }));
  const files = getFiles();

  const invalidImports = [];
  const resolvedImports = [];

  for (const file of files) {
    const content = readFileSync(join(REPO_ROOT, file), 'utf8');
    const specifiers = getThemeSpecifiers(content);

    for (const specifier of specifiers) {
      const subpath = toSubpath(specifier);
      if (!subpath) continue;

      const match = exportMatchers.find(({ regex }) => regex.test(subpath));
      if (!match) {
        invalidImports.push({ file, specifier, subpath });
        continue;
      }

      resolvedImports.push({ file, specifier, exportKey: match.key });
    }
  }

  if (invalidImports.length > 0) {
    console.error('Found @goldshore/theme imports that are not covered by package exports:');
    for (const item of invalidImports) {
      console.error(`- ${item.file}: ${item.specifier} (expects export key ${item.subpath})`);
    }
    process.exit(1);
  }

  console.log(`Resolved ${resolvedImports.length} @goldshore/theme import(s) to declared exports.`);

  const gsWebImports = resolvedImports.filter((item) => item.file.startsWith('apps/gs-web/'));
  if (gsWebImports.length > 0) {
    console.log('apps/gs-web imports:');
    for (const item of gsWebImports) {
      console.log(`- ${item.file}: ${item.specifier} -> ${item.exportKey}`);
    }
  }
}

main();
