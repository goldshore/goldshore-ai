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

  if (filename === 'deploy-gs-api.yml') {
    const deployJob = workflow.jobs.deploy;
    const steps = Array.isArray(deployJob?.steps) ? deployJob.steps : [];
    const stepIndex = (name) => steps.findIndex((step) => step?.name === name);
    const runFor = (name) => steps.find((step) => step?.name === name)?.run ?? '';

    const reconcileIndex = stepIndex('Reconcile legacy users schema');
    const ownerMigrationIndex = stepIndex('Apply Google Workspace RBAC schema');
    if (reconcileIndex < 0 || ownerMigrationIndex < 0 || reconcileIndex >= ownerMigrationIndex) {
      failures.push(
        `${filename}: legacy users schema reconciliation must run before the owner-role migration`,
      );
    }

    if (!runFor('Reconcile legacy users schema').includes('scripts/reconcile-d1-users-schema.sh')) {
      failures.push(`${filename}: users schema reconciliation must use the reviewed recovery script`);
    }

    if (!runFor('Deploy production Worker').includes('wrangler deploy --env prod')) {
      failures.push(`${filename}: production API deployment must select the prod Wrangler environment`);
    }

    const readinessRun = runFor('Health and readiness checks (gs-api)');
    if (!readinessRun.includes('/health') || !readinessRun.includes('/ready')) {
      failures.push(`${filename}: production verification must check both API liveness and readiness`);
    }
  }
}

if (failures.length) {
  console.error('Workflow validation failed:\n' + failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(`Validated ${workflowFiles.length} workflow files.`);
