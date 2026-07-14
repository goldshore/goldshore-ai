#!/usr/bin/env node

const args = new Set(process.argv.slice(2));

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? 'f77de112d2019e5456a3198a8bb50bd2';
const CLIENT_ID = process.env.CLOUDFLARE_OAUTH_CLIENT_ID ?? '5bc4be37cd1cb60bb70811abdd4be8e6';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID ?? '80e5c7c62d36a73f7a0e31bb3cd9223a';
const ZONE_NAME = process.env.CLOUDFLARE_ZONE_NAME ?? 'goldshore.ai';
const PUBLISHER_TXT =
  process.env.CLOUDFLARE_OAUTH_CLIENT_PUBLISHER ??
  'cloudflare_oauth_client_publisher=ced474299e347938e30557e170c56beb';

const desiredClient = {
  client_name: 'Goldshore Git + Workers MCP Client',
  client_uri: 'https://goldshore.ai/developer',
  logo_uri: 'https://goldshore.ai/assets/logo.svg',
  policy_uri: 'https://goldshore.ai/legal/privacy',
  tos_uri: 'https://goldshore.ai/legal/terms',
  response_types: ['code'],
  grant_types: ['authorization_code', 'refresh_token'],
  token_endpoint_auth_method: 'none',
  redirect_uris: [
    'http://127.0.0.1:33418',
    'http://127.0.0.1:33418/',
    'https://vscode.dev/redirect'
  ],
  allowed_cors_origins: ['https://vscode.dev', 'https://goldshore.ai'],
  scopes: [
    'user-details.read',
    'workers-scripts.write',
    'workers-routes.write',
    'workers-kv-storage.write',
    'workers-tail.read',
    'workers-ci.write',
    'page.write'
  ]
};

if (args.has('--public')) {
  desiredClient.visibility = 'public';
}

function usage() {
  console.log(`Configure the Goldshore Cloudflare OAuth client.

Required for writes:
  CLOUDFLARE_API_TOKEN with OAuth Clients Write.
  Add Zone DNS Edit too if using --apply-dns.

Preview:
  node scripts/configure-cloudflare-oauth-client.mjs

Apply OAuth client update:
  node scripts/configure-cloudflare-oauth-client.mjs --apply

Create the publisher TXT record:
  node scripts/configure-cloudflare-oauth-client.mjs --apply-dns

Promote to public after DNS verification:
  node scripts/configure-cloudflare-oauth-client.mjs --apply --public
`);
}

async function cf(method, path, body) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    throw new Error('CLOUDFLARE_API_TOKEN is required for writes.');
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    const details = (payload.errors ?? [])
      .map((error) => `${error.code}: ${error.message}`)
      .join('; ');
    throw new Error(details || `Cloudflare API request failed with HTTP ${response.status}`);
  }

  return payload.result;
}

async function applyClient() {
  const result = await cf(
    'PATCH',
    `/accounts/${ACCOUNT_ID}/oauth_clients/${CLIENT_ID}`,
    desiredClient
  );

  console.log(
    JSON.stringify(
      {
        updated: true,
        client_id: result.client_id,
        client_name: result.client_name,
        client_uri: result.client_uri,
        visibility: result.visibility,
        verification: result.client_uri_verification
      },
      null,
      2
    )
  );
}

async function applyDns() {
  const query = new URLSearchParams({ type: 'TXT', name: ZONE_NAME, per_page: '100' });
  const records = await cf('GET', `/zones/${ZONE_ID}/dns_records?${query}`);
  const alreadyPresent = records.some(
    (record) => record.type === 'TXT' && record.name === ZONE_NAME && record.content === PUBLISHER_TXT
  );

  if (alreadyPresent) {
    console.log(`TXT record already present on ${ZONE_NAME}.`);
    return;
  }

  const record = await cf('POST', `/zones/${ZONE_ID}/dns_records`, {
    type: 'TXT',
    name: ZONE_NAME,
    content: PUBLISHER_TXT,
    ttl: 1,
    comment: `OAuth publisher verification for ${desiredClient.client_name}`
  });

  console.log(
    JSON.stringify(
      {
        created: true,
        id: record.id,
        type: record.type,
        name: record.name,
        content: record.content
      },
      null,
      2
    )
  );
}

async function main() {
  if (args.has('--help') || args.has('-h')) {
    usage();
    return;
  }

  if (!args.has('--apply') && !args.has('--apply-dns')) {
    console.log(
      JSON.stringify(
        {
          account_id: ACCOUNT_ID,
          client_id: CLIENT_ID,
          zone_id: ZONE_ID,
          zone_name: ZONE_NAME,
          oauth_client_patch: desiredClient,
          publisher_txt_record: {
            type: 'TXT',
            name: ZONE_NAME,
            content: PUBLISHER_TXT
          }
        },
        null,
        2
      )
    );
    console.log('\nDry run only. Add --apply and/or --apply-dns to write changes.');
    return;
  }

  if (args.has('--apply-dns')) {
    await applyDns();
  }

  if (args.has('--apply')) {
    await applyClient();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
