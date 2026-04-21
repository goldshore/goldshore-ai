#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const repoRoot = process.cwd();
const desiredStatePath = path.join(repoRoot, 'infra/Cloudflare/desired-state.yaml');
const configPath = path.join(repoRoot, 'infra/Cloudflare/config.yaml');

const desired = YAML.parse(fs.readFileSync(desiredStatePath, 'utf8'));
const config = YAML.parse(fs.readFileSync(configPath, 'utf8'));

/** @type {string[]} */
const issues = [];

function addIssue(message) {
  issues.push(message);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    addIssue(`${label}: expected "${expected}", got "${actual ?? '<missing>'}"`);
  }
}

const workerDeployWorkflows = [
  '.github/workflows/deploy-gs-api.yml',
  '.github/workflows/deploy-gs-agent.yml',
  '.github/workflows/deploy-gs-gateway.yml',
  '.github/workflows/deploy-gs-control.yml',
  '.github/workflows/deploy-gs-mail.yml',
];

for (const workflow of workerDeployWorkflows) {
  const body = fs.readFileSync(path.join(repoRoot, workflow), 'utf8');
  if (!body.includes('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_BUILD_API_TOKEN }}')) {
    addIssue(`Worker token policy violation in ${workflow}: expected CLOUDFLARE_API_TOKEN to come only from secrets.CLOUDFLARE_BUILD_API_TOKEN`);
  }
  if (body.includes('CLOUDFLARE_BUILD_API_TOKEN ||') || body.includes('|| secrets.CLOUDFLARE_API_TOKEN')) {
    addIssue(`Worker token policy violation in ${workflow}: fallback token expressions are not allowed`);
  }
}

const args = new Set(process.argv.slice(2));
const allowMissingEnv = args.has('--allow-missing-env');

const token = process.env.CLOUDFLARE_BUILD_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;

async function cfGet(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(`Cloudflare API error (${res.status}) for ${url}: ${JSON.stringify(data)}`);
  }
  return data.result;
}

async function getZoneId(zoneName) {
  const result = await cfGet(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(zoneName)}`);
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error(`Zone not found: ${zoneName}`);
  }
  return result[0].id;
}

async function checkLiveCloudflareState() {
  const pagesProject = desired.cloudflare.pages.projects.find((p) => p.name === 'gs-web');
  if (!pagesProject) {
    addIssue('desired-state.yaml is missing pages.projects entry for gs-web');
    return;
  }

  const project = await cfGet(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${pagesProject.name}`);
  assertEqual(project.production_branch, pagesProject.production_branch, 'gs-web production branch');
  assertEqual(project.build_config?.build_command, pagesProject.build_command, 'gs-web build command');
  assertEqual(project.build_config?.destination_dir, pagesProject.output_dir, 'gs-web output directory');

  const domains = await cfGet(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${pagesProject.name}/domains`);
  const domainNames = new Set(domains.map((d) => d.name));
  for (const expectedDomain of pagesProject.custom_domains) {
    if (!domainNames.has(expectedDomain)) {
      addIssue(`gs-web custom domains: missing ${expectedDomain}`);
    }
  }

  const zoneNames = [desired.cloudflare.zone, ...(desired.cloudflare.secondary_zones || [])];
  const desiredCnameHosts = ['goldshore.ai', 'www.goldshore.ai', 'goldshore.org', 'www.goldshore.org'];

  for (const zoneName of zoneNames) {
    const zoneId = await getZoneId(zoneName);
    const records = await cfGet(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=200&type=CNAME`);

    for (const host of desiredCnameHosts.filter((h) => h === zoneName || h.endsWith(`.${zoneName}`))) {
      const record = records.find((r) => r.name === host);
      if (!record) {
        addIssue(`DNS CNAME missing in zone ${zoneName}: ${host}`);
        continue;
      }
      assertEqual(record.type, 'CNAME', `DNS type for ${host}`);
      assertEqual(record.content, 'gs-web.pages.dev', `DNS content for ${host}`);
      assertEqual(record.proxied, true, `DNS proxied for ${host}`);
    }
  }

  for (const rule of desired.cloudflare.redirects.rules) {
    const sourceHost = rule.from.replace('/*', '');
    const probePath = '/cf-drift-check';
    const res = await fetch(`https://${sourceHost}${probePath}`, { redirect: 'manual' });
    const location = res.headers.get('location');
    const expectedLocation = rule.to.replace('$1', 'cf-drift-check');

    assertEqual(res.status, rule.status, `Redirect status for ${sourceHost}`);
    assertEqual(location, expectedLocation, `Redirect location for ${sourceHost}`);
  }
}

async function main() {
  if (config.projects?.pages?.length === 0) {
    addIssue('config.yaml has no pages projects configured');
  }

  if (!token || !accountId) {
    const message = 'Cloudflare credentials are required (CLOUDFLARE_BUILD_API_TOKEN/CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID).';
    if (allowMissingEnv) {
      console.warn(`WARNING: ${message} Skipping live API checks.`);
    } else {
      addIssue(message);
    }
  } else {
    await checkLiveCloudflareState();
  }

  if (issues.length > 0) {
    console.error('Cloudflare drift check failed:');
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log('Cloudflare drift check passed. No drift detected.');
}

main().catch((error) => {
  console.error(`Cloudflare drift check failed with error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
