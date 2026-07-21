#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const packagePattern = /^@goldshore\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const aliases = JSON.parse(readFileSync(resolve(__dirname, 'name-aliases.json'), 'utf8'));

const fail = [];

function run(file, args) {
  const output = execFileSync(file, args, { cwd: repoRoot, encoding: 'utf8' }).trim();
  return output ? output.split('\n').filter(Boolean) : [];
}

function lintPackages() {
  const packageFiles = run('rg', [
    '--files',
    'apps',
    'packages',
    'infra',
    '-g',
    'package.json',
    '-g',
    '!**/node_modules/**',
  ]);

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
  const workflowFiles = run('rg', ['--files', '.github/workflows', '-g', '*.yml']);

  for (const workflowFile of workflowFiles) {
    const workflowBasename = basename(workflowFile).replace(/\.yml$/, '');
    if (!kebabCasePattern.test(workflowBasename)) {
      fail.push(`${workflowFile}: workflow file name must be kebab-case`);
    }

    const workflow = readFileSync(resolve(repoRoot, workflowFile), 'utf8');
    const jobNames = extractJobNames(workflow);
    for (const jobName of jobNames) {
      if (!kebabCasePattern.test(jobName)) {
        fail.push(`${workflowFile}: job key "${jobName}" must be kebab-case`);
      }
    }
  }
}

function extractJobNames(workflow) {
  const lines = workflow.split(/\r?\n/);
  const jobs = [];
  let inJobs = false;

  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }

    if (!inJobs) {
      continue;
    }

    if (/^\S/.test(line) && !/^jobs:\s*$/.test(line)) {
      break;
    }

    const match = line.match(/^  ([A-Za-z0-9_-]+):\s*(?:#.*)?$/);
    if (match) {
      jobs.push(match[1]);
    }
  }

  return jobs;
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
