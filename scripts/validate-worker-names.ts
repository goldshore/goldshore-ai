import { existsSync, readFileSync } from "node:fs";

const API_WRANGLER = "apps/gs-api/wrangler.toml";
const WEB_WRANGLER = "apps/gs-web/wrangler.jsonc";
const WRANGLER_NAME_PATTERN = /^\s*name\s*=\s*["']([^"']+)["']/m;
const ROUTE_PATTERN = /pattern\s*=\s*["']([^"']+)["']/g;
const EXPECTED_API_HOST_OWNERS: Record<string, string> = {
  "api.goldshore.ai": "gs-api",
  "api-preview.goldshore.ai": "gs-api",
};

function extractHostnames(wranglerRaw: string): string[] {
  const hostnames = new Set<string>();

  for (const match of wranglerRaw.matchAll(ROUTE_PATTERN)) {
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

  if (!existsSync(API_WRANGLER)) {
    failures.push(`missing API Wrangler config: ${API_WRANGLER}`);
  } else {
    const apiWrangler = readFileSync(API_WRANGLER, "utf8");
    const nameMatch = apiWrangler.match(WRANGLER_NAME_PATTERN);

    if (!nameMatch) {
      failures.push(`${API_WRANGLER}: missing top-level name`);
    } else if (nameMatch[1] !== "gs-api") {
      failures.push(`${API_WRANGLER}: expected Worker name "gs-api", found "${nameMatch[1]}"`);
    }

    const hostnames = extractHostnames(apiWrangler);
    for (const hostname of hostnames) {
      const expectedOwner = EXPECTED_API_HOST_OWNERS[hostname];
      if (!expectedOwner) {
        failures.push(`${API_WRANGLER}: unexpected API Worker route hostname "${hostname}"`);
      }
    }

    for (const hostname of Object.keys(EXPECTED_API_HOST_OWNERS)) {
      if (!hostnames.includes(hostname)) {
        failures.push(`${API_WRANGLER}: missing expected route hostname "${hostname}"`);
      }
    }
  }

  if (!existsSync(WEB_WRANGLER)) {
    failures.push(`missing web Wrangler config: ${WEB_WRANGLER}`);
  } else {
    const webWrangler = readFileSync(WEB_WRANGLER, "utf8");
    if (!/"name"\s*:\s*"gs-web"/.test(webWrangler)) {
      failures.push(`${WEB_WRANGLER}: expected Pages project name "gs-web"`);
    }
  }

  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const failures = validateWorkerNames();

  if (failures.length > 0) {
    console.error("Worker naming validation failed:\n");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Worker naming validation passed.");
}
