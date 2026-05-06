#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const map = fs
  .readFileSync('reports/migration/path-map.tsv', 'utf8')
  .trim()
  .split('\n')
  .slice(1);
const manifest = 'reports/migration/manifest.ndjson';
const conflicts = ['from\tto\tmode\tnote'];

function sha(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}
function log(o) {
  fs.appendFileSync(manifest, JSON.stringify(o) + '\n');
}
fs.writeFileSync(manifest, '');

for (const line of map) {
  const [from, to, category] = line.split('\t');
  if (!fs.existsSync(from)) continue;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  const bytes = fs.statSync(from).size;

  try {
    fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
    log({
      action: 'copy',
      from,
      to,
      bytes,
      sha256_before: sha(from),
      sha256_after: sha(to),
    });
    continue;
  } catch (error) {
    if (
      !(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'EEXIST'
      )
    ) {
      throw error;
    }
  }

  const sFrom = sha(from),
    sTo = sha(to);
  if (sFrom === sTo) {
    conflicts.push(`${from}\t${to}\tskip_identical\tidentical content`);
    log({
      action: 'skip_identical',
      from,
      to,
      bytes,
      sha256_before: sFrom,
      sha256_after: sTo,
    });
  } else {
    const legacy = `${to}.legacy`;
    fs.copyFileSync(from, legacy);
    conflicts.push(
      `${from}\t${to}\tmanual_merge\tlegacy copy created at ${legacy}`,
    );
    log({
      action: 'conflict_legacy_copy',
      from,
      to: legacy,
      bytes,
      sha256_before: sFrom,
      sha256_after: sha(legacy),
    });
    if (category === 'E' && to.endsWith('.yml')) {
      // conservative merge: keep dest, append comment with source pointer
      const add = `\n# Legacy candidate retained at ${legacy}\n`;
      fs.appendFileSync(to, add);
      conflicts.push(
        `${from}\t${to}\tappend_note\tworkflow retained, note appended`,
      );
    }
  }
}
fs.writeFileSync(
  'reports/migration/conflicts.tsv',
  conflicts.join('\n') + '\n',
);
fs.writeFileSync(
  'reports/migration/merge-decisions.md',
  '# Merge Decisions\n\n- Identical files: skipped and logged as `skip_identical`.\n- Non-identical conflicts: created `*.legacy` sidecar copies for manual/semantic merge.\n- GitHub workflow conflicts: canonical destination retained; note appended and legacy copy kept for review.\n',
);
console.log('applied map + wrote manifest/conflicts');
