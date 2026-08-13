#!/usr/bin/env node

import assert from 'node:assert/strict';

const args = process.argv.slice(2);
assert.equal(args.shift(), '--sha', 'usage: verify-gs-web-release.mjs --sha SHA URL...');
const expectedSha = args.shift();
assert.match(expectedSha ?? '', /^[0-9a-f]{40,64}$/i, 'release SHA must be a full Git commit SHA');
assert.ok(args.length >= 2, 'at least two mirror URLs are required');

const accessHeaders = {};
if (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET) {
  accessHeaders['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID;
  accessHeaders['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET;
}

async function requestMarker(origin) {
  const endpoint = new URL('/.well-known/gs-release.json', origin);
  let lastError;

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(endpoint, { headers: accessHeaders, redirect: 'manual' });
      const body = await response.text();
      assert.equal(response.status, 200, `${endpoint} returned HTTP ${response.status}: ${body.slice(0, 200)}`);
      const marker = JSON.parse(body);
      assert.equal(marker.application, 'gs-web', `${endpoint} returned another application`);
      assert.equal(marker.releaseSha, expectedSha, `${endpoint} has the wrong release SHA`);
      assert.equal(typeof marker.themeId, 'string', `${endpoint} omitted themeId`);
      assert.equal(typeof marker.buildId, 'string', `${endpoint} omitted buildId`);
      return { origin, status: response.status, marker };
    } catch (error) {
      lastError = error;
      if (attempt < 6) await new Promise((resolve) => setTimeout(resolve, attempt * 10_000));
    }
  }

  throw lastError;
}

const results = await Promise.all(args.map(requestMarker));
const baseline = results[0];
for (const result of results.slice(1)) {
  assert.equal(result.status, baseline.status, `${result.origin} response status differs from ${baseline.origin}`);
  assert.equal(result.marker.themeId, baseline.marker.themeId, `${result.origin} theme differs from ${baseline.origin}`);
  assert.equal(result.marker.buildId, baseline.marker.buildId, `${result.origin} build differs from ${baseline.origin}`);
  assert.equal(result.marker.releaseSha, baseline.marker.releaseSha, `${result.origin} release differs from ${baseline.origin}`);
}

console.log(JSON.stringify(results, null, 2));
