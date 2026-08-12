import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';

const workflowDirectory = resolve('.github/workflows');
const workflowFiles = readdirSync(workflowDirectory)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .sort();

const failures = [];

for (const filename of workflowFiles) {
  const path = resolve(workflowDirectory, filename);
  let workflow;

  try {
    workflow = YAML.parse(readFileSync(path, 'utf8'), { uniqueKeys: true });
  } catch (error) {
    failures.push(`${filename}: invalid YAML: ${error.message}`);
    continue;
  }

  if (!workflow || typeof workflow !== 'object') {
    failures.push(`${filename}: workflow must be a mapping`);
    continue;
  }
  if (typeof workflow.name !== 'string' || !workflow.name.trim()) {
    failures.push(`${filename}: missing workflow name`);
  }
  if (!Object.hasOwn(workflow, 'on')) {
    failures.push(`${filename}: missing on trigger`);
  }
  if (!workflow.jobs || typeof workflow.jobs !== 'object' || Array.isArray(workflow.jobs)) {
    failures.push(`${filename}: jobs must be a non-empty mapping`);
    continue;
  }

  const jobs = Object.entries(workflow.jobs);
  if (jobs.length === 0) failures.push(`${filename}: jobs must not be empty`);

  for (const [jobName, job] of jobs) {
    if (!job || typeof job !== 'object' || Array.isArray(job)) {
      failures.push(`${filename}: job ${jobName} must be a mapping`);
      continue;
    }

    const reusable = typeof job.uses === 'string' && job.uses.trim();
    const runnable = typeof job['runs-on'] === 'string' || Array.isArray(job['runs-on']);
    if (!reusable && !runnable) {
      failures.push(`${filename}: job ${jobName} requires runs-on or uses`);
    }
    if (runnable && (!Array.isArray(job.steps) || job.steps.length === 0)) {
      failures.push(`${filename}: job ${jobName} requires at least one step`);
    }
  }
}

if (failures.length) {
  console.error('Workflow validation failed:\n' + failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(`Validated ${workflowFiles.length} workflow files.`);
