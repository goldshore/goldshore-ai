#!/usr/bin/env node

const token = process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_BUILD_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const dryRun = process.argv.includes('--dry-run');

if ((!token || !accountId) && !dryRun) {
  console.error('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID before applying Pages build settings.');
  process.exit(1);
}

const projects = [
  {
    name: 'gs-web',
    build_command: 'pnpm --filter @goldshore/gs-web build',
    destination_dir: 'apps/gs-web/dist',
    root_dir: '',
  },
  {
    name: 'gs-admin-prod',
    build_command: 'pnpm --filter @goldshore/gs-web build',
    destination_dir: 'apps/gs-web/dist',
    root_dir: '',
  },
];

async function cf(method, path, body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!data.success) {
    const errors = data.errors ?? [];
    const authError = errors.some((error) => error.code === 10000);
    if (authError) {
      throw new Error(
        `${method} ${path} failed: token needs Account > Cloudflare Pages > Edit on this account.`,
      );
    }

    throw new Error(`${method} ${path} failed: ${JSON.stringify(errors)}`);
  }

  return data.result;
}

for (const project of projects) {
  if (dryRun) {
    console.log(
      `[dry-run] ${project.name}: build="${project.build_command}", root="${project.root_dir}", output="${project.destination_dir}"`,
    );
    continue;
  }

  const result = await cf('PATCH', `/pages/projects/${project.name}`, {
    build_config: {
      build_command: project.build_command,
      destination_dir: project.destination_dir,
      root_dir: project.root_dir,
    },
  });

  console.log(
    `${result.name}: build="${result.build_config.build_command}", root="${result.build_config.root_dir}", output="${result.build_config.destination_dir}"`,
  );
}
