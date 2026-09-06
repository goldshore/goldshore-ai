#!/usr/bin/env node

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const masterKey = process.env.INTEGRATION_MASTER_KEY;
const storeId = 'b9824d3280c54573a24137c7e7143b33';
const secretName = 'INTEGRATION_MASTER_KEY';

if (!accountId || !apiToken || !masterKey) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and INTEGRATION_MASTER_KEY are required');
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/secrets_store/stores/${storeId}/secrets`;
const headers = { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' };
const existingResponse = await fetch(endpoint, { headers });
const existingPayload = await existingResponse.json();
if (!existingResponse.ok || !existingPayload.success) throw new Error('Unable to list the production Secrets Store');

const existing = existingPayload.result.find((secret) => secret.name === secretName);
if (existing) {
  if (!existing.scopes.includes('workers')) throw new Error(`${secretName} exists but is not scoped to workers`);
  console.log(`${secretName} is already present in the Secrets Store; value left unchanged.`);
  process.exit(0);
}

const createResponse = await fetch(endpoint, {
  method: 'POST',
  headers,
  body: JSON.stringify([{ name: secretName, value: masterKey, scopes: ['workers'], comment: 'Restored from protected GitHub environment secret for gs-api integration encryption.' }]),
});
const createPayload = await createResponse.json();
if (!createResponse.ok || !createPayload.success) throw new Error('Unable to create the integration master key in Secrets Store');
console.log(`${secretName} was created in the Secrets Store with workers scope.`);
