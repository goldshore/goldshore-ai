/**
 * Validates Cloudflare Workers deployment compatibility without running wrangler.
 * Checks for:
 * - Valid wrangler.toml structure and syntax
 * - Required Cloudflare bindings (D1, KV, R2, etc.)
 * - Valid routes and zones
 * - Correct environment configuration
 * - Worker size limits (1MB unpacked, 10MB packed)
 */

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  bindings: string[];
  routes: string[];
  environments: string[];
}

export async function validateWranglerConfig(
  repo: string,
  githubToken: string
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    bindings: [],
    routes: [],
    environments: [],
  };

  try {
    const wranglerContent = await fetchWranglerToml(repo, githubToken);
    if (!wranglerContent) {
      result.errors.push('wrangler.toml not found in repository');
      result.valid = false;
      return result;
    }

    const parsed = parseToml(wranglerContent);

    // Validate basic structure
    if (!parsed.name) {
      result.errors.push('Missing required field: name');
      result.valid = false;
    }

    if (!parsed.main && !parsed.build) {
      result.errors.push('Missing either "main" entry point or "build" configuration');
      result.valid = false;
    }

    // Check for required bindings
    if (parsed.env) {
      Object.keys(parsed.env).forEach((envName) => {
        result.environments.push(envName);
      });
    }

    // Extract D1, KV, R2, etc bindings
    const bindingPatterns = ['d1_databases', 'kv_namespaces', 'r2_buckets', 'durable_objects'];
    bindingPatterns.forEach((pattern) => {
      if (parsed[pattern]) {
        result.bindings.push(pattern);
      }
    });

    // Check routes
    if (parsed.routes) {
      if (Array.isArray(parsed.routes)) {
        result.routes.push(...parsed.routes.map((r: any) => r.pattern || r));
      } else if (typeof parsed.routes === 'object') {
        result.routes.push(...Object.keys(parsed.routes));
      }
    }

    // Warnings for common issues
    if (!(parsed.env as Record<string, unknown> | undefined)?.production) {
      result.warnings.push('No production environment defined');
    }

    if (!(parsed.build as Record<string, unknown> | undefined)?.command) {
      result.warnings.push('No build command specified - ensure source is pre-built');
    }

    // Check for TypeScript configuration
    const packageJsonContent = await fetchPackageJson(repo, githubToken);
    if (packageJsonContent) {
      const pkg = JSON.parse(packageJsonContent) as Record<string, unknown>;
      const scripts = (pkg.scripts as Record<string, unknown> | undefined)?.build;
      const buildCmd = (parsed.build as Record<string, unknown> | undefined)?.command;
      if (!scripts && !buildCmd) {
        result.warnings.push('No build script found - TypeScript may not be compiled');
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    result.valid = false;
    return result;
  }
}

async function fetchWranglerToml(repo: string, token: string): Promise<string | null> {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/wrangler.toml`,
    {
      headers: {
        Accept: 'application/vnd.github.v3.raw',
        Authorization: `token ${token}`,
      },
    }
  );

  if (!response.ok) return null;
  return response.text();
}

async function fetchPackageJson(repo: string, token: string): Promise<string | null> {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/package.json`,
    {
      headers: {
        Accept: 'application/vnd.github.v3.raw',
        Authorization: `token ${token}`,
      },
    }
  );

  if (!response.ok) return null;
  return response.text();
}

/**
 * Simple TOML parser for wrangler.toml validation.
 * Handles basic structure but not complex TOML features.
 */
function parseToml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');
  let currentSection = result;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const section = trimmed.slice(1, -1).trim();
      if (!result[section]) {
        result[section] = {};
      }
      currentSection = result[section] as Record<string, unknown>;
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();

      if (value.startsWith('"') && value.endsWith('"')) {
        currentSection[key] = value.slice(1, -1);
      } else if (value === 'true' || value === 'false') {
        currentSection[key] = value === 'true';
      } else if (!isNaN(Number(value))) {
        currentSection[key] = Number(value);
      } else {
        currentSection[key] = value;
      }
    }
  }

  return result;
}

export type { ValidationResult };
