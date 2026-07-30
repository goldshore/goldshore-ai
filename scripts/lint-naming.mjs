#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const packagePattern = /^@goldshore\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const aliases = JSON.parse(readFileSync(resolve(__dirname, 'name-aliases.json'), 'utf8'));

const fail = [];

function findFiles(root, matches) {
  const files = [];

  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;

      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
      } else if (entry.isFile() && matches(entry.name)) {
        files.push(relative(repoRoot, absolutePath).replaceAll('\\', '/'));
      }
    }
  }

  walk(resolve(repoRoot, root));
  return files;
}

function lintPackages() {
  const packageFiles = ['apps', 'packages', 'infra'].flatMap((root) =>
    findFiles(root, (name) => name === 'package.json'),
  );

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
  const workflowFiles = findFiles('.github/workflows', (name) => name.endsWith('.yml'));

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
