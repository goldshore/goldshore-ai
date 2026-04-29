#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const raw = await readFile('docs/architecture/route-map.json', 'utf8');
const data = JSON.parse(raw);

const collisions = new Map();
for (const route of data.routes) {
  if (route.status !== 'active') continue;
  if (route.kind === 'frontend-page') continue;
  const key = `${route.owner} ${route.method} ${route.path}`;
  const arr = collisions.get(key) ?? [];
  arr.push(route.source);
  collisions.set(key, arr);
}

const dupes = [...collisions.entries()].filter(([, sources]) => sources.length > 1);

if (dupes.length) {
  console.error('Route collisions detected:');
  for (const [sig, sources] of dupes) {
    console.error(`- ${sig}`);
    for (const source of sources) {
      console.error(`  - ${source}`);
    }
  }
  process.exit(1);
}

console.log('No route collisions detected.');
