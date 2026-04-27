#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const DEFAULT_SCOPE = [
  'README.md',
  'CURRENT_MONOREPO_STATE.md',
  'DEPRECATED_PACKAGES.md',
  'BRANCH_STATUS.md',
  'BRANCHES_TO_ARCHIVE.md',
  'docs/ops/mergeable-branches.md',
];

function getMarkdownFiles(useAllFiles) {
  if (!useAllFiles) return DEFAULT_SCOPE;
  const output = execSync("git ls-files '*.md'", { encoding: 'utf8' });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeHeading(value) {
  return value
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[()\[\]{}:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTableBlock(lines) {
  const rows = lines
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells.length > 1);

  if (rows.length < 2) return null;
  const headers = rows[0];
  return { headers, rows: rows.slice(2) };
}

function findTableConflicts(files) {
  const conflicts = [];
  const registry = new Map();

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    let i = 0;

    while (i < lines.length) {
      if (!lines[i].trim().startsWith('|')) {
        i += 1;
        continue;
      }

      const block = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        block.push(lines[i]);
        i += 1;
      }

      const parsed = parseTableBlock(block);
      if (!parsed) continue;

      const normalizedHeaders = parsed.headers.map((h) => h.toLowerCase());
      const hasBranchTable = normalizedHeaders.some((h) => h.includes('branch'));
      const hasPackageTable = normalizedHeaders.some(
        (h) => h.includes('package') || h.includes('workspace'),
      );

      if (!hasBranchTable && !hasPackageTable) continue;

      const domain = hasBranchTable ? 'branch' : 'package';
      const keyIndex = parsed.headers.findIndex((header) => {
        const lower = header.toLowerCase();
        if (domain === 'branch') return lower.includes('branch');
        return lower.includes('package') || lower.includes('workspace');
      });

      if (keyIndex === -1) continue;

      for (const row of parsed.rows) {
        const key = row[keyIndex]?.trim();
        if (!key) continue;

        const signature = parsed.headers
          .map((header, idx) => `${header}:${row[idx] ?? ''}`)
          .join('|');

        const registryKey = `${domain}::${key}`;
        const entry = registry.get(registryKey) ?? [];
        entry.push({ file, signature });
        registry.set(registryKey, entry);
      }
    }
  }

  for (const [key, entries] of registry.entries()) {
    const signatures = new Set(entries.map((entry) => entry.signature));
    if (signatures.size <= 1) continue;

    conflicts.push({ key, entries });
  }

  return conflicts;
}

function findHeadingDuplicates(files) {
  const perFileDuplicates = [];
  const h1Registry = new Map();

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const seen = new Map();

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/);
      if (!headingMatch) continue;

      const level = headingMatch[1].length;
      const text = headingMatch[2].replace(/\s+#*$/, '').trim();
      const normalized = normalizeHeading(text);

      seen.set(normalized, (seen.get(normalized) ?? 0) + 1);

      if (level === 1) {
        const list = h1Registry.get(normalized) ?? [];
        list.push({ file, text });
        h1Registry.set(normalized, list);
      }
    }

    for (const [normalized, count] of seen.entries()) {
      if (count > 1) {
        perFileDuplicates.push({ file, heading: normalized, count });
      }
    }
  }

  const globalH1Duplicates = [];
  for (const [normalized, entries] of h1Registry.entries()) {
    const uniqueFiles = new Set(entries.map((entry) => entry.file));
    if (uniqueFiles.size > 1) {
      globalH1Duplicates.push({ heading: normalized, entries });
    }
  }

  return { perFileDuplicates, globalH1Duplicates };
}

function main() {
  const useAllFiles = process.argv.includes('--all');
  const files = getMarkdownFiles(useAllFiles);
  const { perFileDuplicates, globalH1Duplicates } = findHeadingDuplicates(files);
  const tableConflicts = findTableConflicts(files);

  if (
    perFileDuplicates.length === 0 &&
    globalH1Duplicates.length === 0 &&
    tableConflicts.length === 0
  ) {
    console.log(`Doc consistency check passed (${useAllFiles ? 'all markdown files' : 'canonical scope'}).`);
    process.exit(0);
  }

  console.error('Doc consistency check failed.');

  if (perFileDuplicates.length > 0) {
    console.error('\nDuplicate section headings (within a file):');
    for (const item of perFileDuplicates) {
      console.error(`- ${item.file}: "${item.heading}" appears ${item.count} times`);
    }
  }

  if (globalH1Duplicates.length > 0) {
    console.error('\nDuplicate H1 headings (across files):');
    for (const item of globalH1Duplicates) {
      const filesWithHeading = item.entries.map((entry) => entry.file).join(', ');
      console.error(`- "${item.heading}" found in: ${filesWithHeading}`);
    }
  }

  if (tableConflicts.length > 0) {
    console.error('\nConflicting branch/package table rows:');
    for (const conflict of tableConflicts) {
      console.error(`- ${conflict.key}`);
      for (const entry of conflict.entries) {
        console.error(`  - ${entry.file}: ${entry.signature}`);
      }
    }
  }

  process.exit(1);
}

main();
