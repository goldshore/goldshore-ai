#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import YAML from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const packagePattern = /^@goldshore\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const aliases = JSON.parse(readFileSync(resolve(__dirname, 'name-aliases.json'), 'utf8'));

const fail = [];

function run(command) {
  const output = execSync(command, { cwd: repoRoot, encoding: 'utf8' }).trim();
  return output ? output.split('\n').filter(Boolean) : [];
}

function lintPackages() {
  const packageFiles = run("rg --files apps packages infra -g 'package.json' -g '!**/node_modules/**'");

  for (const packageFile of packageFiles) {
    const packageJson = JSON.parse(readFileSync(resolve(repoRoot, packageFile), 'utf8'));
    const packageName = packageJson.name;

    if (!packageName) {
      fail.push(`${packageFile}: missing package name`);
      continue;
    }

    if (packagePattern.test(packageName)) {
      continue;
    }

    if (aliases.packages[packageName]) {
      continue;
    }

    fail.push(`${packageFile}: package name "${packageName}" must match ${packagePattern}`);
  }
}

function lintWorkflows() {
  const workflowFiles = run("rg --files .github/workflows -g '*.yml'");

  for (const workflowFile of workflowFiles) {
    const workflowBasename = workflowFile.split('/').pop().replace(/\.yml$/, '');
    if (!kebabCasePattern.test(workflowBasename)) {
      fail.push(`${workflowFile}: workflow file name must be kebab-case`);
    }

    const workflow = YAML.parse(readFileSync(resolve(repoRoot, workflowFile), 'utf8'));
    const jobs = workflow?.jobs ?? {};
    for (const jobName of Object.keys(jobs)) {
      if (!kebabCasePattern.test(jobName)) {
        fail.push(`${workflowFile}: job key "${jobName}" must be kebab-case`);
      }
    }
  }
}

lintPackages();
lintWorkflows();

if (fail.length > 0) {
  console.error('Naming lint failed:');
  for (const issue of fail) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('Naming lint passed.');
