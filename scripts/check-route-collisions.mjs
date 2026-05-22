#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

function collectCanonicalGatewayHostsFromDocs(markdown) {
  const canonicalHosts = new Set();
  const lines = markdown.split('\n');

  for (const line of lines) {
    if (!/canonical/i.test(line)) continue;
    if (!/(gw|gateway)\.goldshore\.ai/i.test(line)) continue;

    const firstHostMatch = line.match(/`((?:gw|gateway)\.goldshore\.ai)`/i);
    if (firstHostMatch) {
      canonicalHosts.add(firstHostMatch[1].toLowerCase());
    }
  }

  return canonicalHosts;
}

function collectGatewayHostsFromWrangler(wranglerToml) {
  const hosts = new Set();
  const routePattern = /pattern\s*=\s*"((?:gw|gateway)\.goldshore\.ai)\/\*"/gi;

  let match;
  while ((match = routePattern.exec(wranglerToml)) !== null) {
    hosts.add(match[1].toLowerCase());
  }

  return hosts;
}

const routeMapRaw = await readFile('docs/architecture/route-map.json', 'utf8');
const routeMap = JSON.parse(routeMapRaw);

const collisions = new Map();
for (const route of routeMap.routes) {
  if (route.status !== 'active') continue;
  if (route.kind === 'frontend-page') continue;
  const key = `${route.owner} ${route.method} ${route.path}`;
  const arr = collisions.get(key) ?? [];
  arr.push(route.source);
  collisions.set(key, arr);
}

const dupes = [...collisions.entries()].filter(([, sources]) => sources.length > 1);
const errors = [];

if (dupes.length) {
  errors.push('Route collisions detected:');
  for (const [sig, sources] of dupes) {
    errors.push(`- ${sig}`);
    for (const source of sources) {
      errors.push(`  - ${source}`);
    }
  }
}

const domainsDoc = await readFile('docs/domains-and-auth.md', 'utf8');
const wranglerToml = await readFile('apps/gs-gateway/wrangler.toml', 'utf8');

const canonicalHosts = collectCanonicalGatewayHostsFromDocs(domainsDoc);
const wranglerGatewayHosts = collectGatewayHostsFromWrangler(wranglerToml);

if (canonicalHosts.size !== 1) {
  errors.push(
    `Expected exactly one canonical gateway hostname declaration in docs/domains-and-auth.md, found ${canonicalHosts.size}: ${[...canonicalHosts].join(', ') || '(none)'}.`,
  );
}

if (wranglerGatewayHosts.size !== 1) {
  errors.push(
    `Expected exactly one gateway route hostname in apps/gs-gateway/wrangler.toml, found ${wranglerGatewayHosts.size}: ${[...wranglerGatewayHosts].join(', ') || '(none)'}.`,
  );
}

if (canonicalHosts.size === 1 && wranglerGatewayHosts.size === 1) {
  const [canonicalHost] = [...canonicalHosts];
  const [wranglerHost] = [...wranglerGatewayHosts];
  if (canonicalHost !== wranglerHost) {
    errors.push(
      `Canonical gateway hostname mismatch: docs declare ${canonicalHost}, wrangler routes declare ${wranglerHost}.`,
    );
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('No route collisions detected.');
console.log('Canonical gateway hostname declarations are consistent.');
