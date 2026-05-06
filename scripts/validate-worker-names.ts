import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { join } from "node:path";

const APPS_DIR = path.resolve(process.cwd(), "apps");
const WRANGLER_NAME_PATTERN = /^\s*name\s*=\s*["']([^"']+)["']/m;
const ROUTE_PATTERN = /pattern\s*=\s*["']([^"']+)["']/g;
const SINGLE_ROUTE_PATTERN = /^\s*route\s*=\s*["']([^"']+)["']/gm;
const EXPECTED_HOST_OWNERS: Record<string, string> = {
  "gw.goldshore.ai": "gs-gateway",
  "agent.goldshore.ai": "gs-gateway",
};

function getWorkerDirectories(): string[] {
  return readdirSync(APPS_DIR)
    .map((entry) => path.join(APPS_DIR, entry))
    .filter((fullPath) => statSync(fullPath).isDirectory())
    .filter((fullPath) => existsSync(path.join(fullPath, "wrangler.toml")))
    .filter((fullPath) => !fullPath.includes(`${path.sep}legacy${path.sep}`));
}

function extractHostnames(wranglerRaw: string): string[] {
  const hostnames = new Set<string>();

  for (const match of wranglerRaw.matchAll(ROUTE_PATTERN)) {
    const pattern = match[1]?.trim();
    const hostname = pattern?.split("/")[0]?.toLowerCase();
    if (hostname) {
      hostnames.add(hostname);
    }
  }

  for (const match of wranglerRaw.matchAll(SINGLE_ROUTE_PATTERN)) {
    const pattern = match[1]?.trim();
    const hostname = pattern?.split("/")[0]?.toLowerCase();
    if (hostname) {
      hostnames.add(hostname);
    }
  }

  return Array.from(hostnames);
}

export function validateWorkerNames(): string[] {
  const failures: string[] = [];
  const names = new Map<string, string>();
  const hostOwners = new Map<string, string>();

  for (const workerDir of getWorkerDirectories()) {
    const folderName = path.basename(workerDir);
    const wranglerPath = path.join(workerDir, "wrangler.toml");
    const wranglerRaw = readFileSync(wranglerPath, "utf8");
    const nameMatch = wranglerRaw.match(WRANGLER_NAME_PATTERN);

    if (!nameMatch) {
      failures.push(`${folderName}: missing top-level name in wrangler.toml`);
      continue;
    }

    const workerName = nameMatch[1];

    if (folderName !== workerName) {
      failures.push(
        `${folderName}: wrangler name "${workerName}" requires folder to be "${workerName}"`,
      );
    }

    if (names.has(workerName)) {
      failures.push(`${folderName}: duplicate wrangler name "${workerName}" also used by ${names.get(workerName)}`);
    } else {
      names.set(workerName, folderName);
    }

    const hostnames = extractHostnames(wranglerRaw);
    for (const hostname of hostnames) {
      const existingOwner = hostOwners.get(hostname);
      if (existingOwner && existingOwner !== workerName) {
        failures.push(
          `${folderName}: hostname collision for "${hostname}" between "${existingOwner}" and "${workerName}"`,
        );
      } else {
        hostOwners.set(hostname, workerName);
      }

      const expectedOwner = EXPECTED_HOST_OWNERS[hostname];
      if (expectedOwner && expectedOwner !== workerName) {
        failures.push(
          `${folderName}: hostname ownership mismatch for "${hostname}" (expected "${expectedOwner}", found "${workerName}")`,
        );
      }
    }
  }

  for (const [hostname, expectedOwner] of Object.entries(EXPECTED_HOST_OWNERS)) {
    const owner = hostOwners.get(hostname);
    if (!owner) {
      failures.push(`missing hostname route for "${hostname}"; expected owner "${expectedOwner}"`);
      continue;
    }

    if (owner !== expectedOwner) {
      failures.push(
        `hostname ownership mismatch for "${hostname}" (expected "${expectedOwner}", found "${owner}")`,
      );
    }
  }

  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const failures = validateWorkerNames();
  let failed = false;

  if (failures.length > 0) {
    console.error("Worker naming validation failed:\n");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    failed = true;
  }

  const CANONICAL_WORKERS = ["gs-agent", "gs-api", "gs-control", "gs-gateway", "gs-mail"];
  const appsDirStr = "apps";

  for (const worker of CANONICAL_WORKERS) {
    const wranglerPath = join(appsDirStr, worker, "wrangler.toml");

    if (!existsSync(wranglerPath)) {
      failed = true;
      console.error(`Missing wrangler.toml for ${worker}: ${wranglerPath}`);
      continue;
    }

    const content = readFileSync(wranglerPath, "utf8");
    const match = content.match(/^\s*name\s*=\s*["']([^"']+)["']/m);

    if (!match) {
      failed = true;
      console.error(`Could not parse worker name from ${wranglerPath}`);
      continue;
    }

    const configuredName = match[1]?.trim();
    if (configuredName !== worker) {
      failed = true;
      console.error(`Worker name mismatch in ${wranglerPath}: expected '${worker}', got '${configuredName}'`);
      continue;
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log("Worker naming validation passed.");
}
