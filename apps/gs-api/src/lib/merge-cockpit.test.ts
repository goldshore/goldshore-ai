import assert from 'node:assert/strict';
import test from 'node:test';
import { buildConflictFiles, checksAreGreen, classifyMergeRisk, validateResolutions } from './merge-cockpit';

test('flags files changed on current main and the incoming branch as semantic conflicts', () => {
  const files = buildConflictFiles(['apps/gs-web/src/middleware.ts', 'README.md'], [
    'apps/gs-web/src/middleware.ts', '.github/workflows/ci.yml',
  ]);
  assert.equal(files.find((file) => file.filename === 'apps/gs-web/src/middleware.ts')?.semanticConflict, true);
  assert.equal(files.find((file) => file.filename === 'README.md')?.semanticConflict, false);
  assert.equal(files.find((file) => file.filename === '.github/workflows/ci.yml')?.risk, 'critical');
});

test('classifies routing and deployment contracts conservatively', () => {
  assert.equal(classifyMergeRisk('apps/gs-api/wrangler.toml'), 'critical');
  assert.equal(classifyMergeRisk('apps/gs-api/src/routes/admin.ts'), 'high');
  assert.equal(classifyMergeRisk('docs/guide.md'), 'normal');
});

test('requires every reported check to be completed and acceptable', () => {
  assert.equal(checksAreGreen([]), false);
  assert.equal(checksAreGreen([{ name: 'CI', status: 'completed', conclusion: 'success' }]), true);
  assert.equal(checksAreGreen([{ name: 'Cloudflare', status: 'completed', conclusion: 'failure' }]), false);
  assert.equal(checksAreGreen([{ name: 'CI', status: 'in_progress', conclusion: null }]), false);
});

test('rejects resolutions outside the reviewed conflict set', () => {
  assert.deepEqual(validateResolutions({ 'a.ts': 'current' }, ['a.ts']), { 'a.ts': 'current' });
  assert.equal(validateResolutions({ 'other.ts': 'incoming' }, ['a.ts']), null);
  assert.equal(validateResolutions({ 'a.ts': 'combine' }, ['a.ts']), null);
});
