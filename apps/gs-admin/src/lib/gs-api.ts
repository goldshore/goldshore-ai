type GsApiEnv = {
  API_ORIGIN?: string;
  GS_API_URL?: string;
  GS_API_SERVICE_TOKEN?: string;
  API_SERVICE?: Fetcher;
};

const DEFAULT_API_ORIGIN = 'https://api.goldshore.ai';
const SERVICE_BINDING_ORIGIN = 'https://gs-api';

export function getGsApiBaseUrl(env: GsApiEnv) {
  return env.API_ORIGIN || env.GS_API_URL || DEFAULT_API_ORIGIN;
}

export function buildGsApiHeaders(env: GsApiEnv) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (env.GS_API_SERVICE_TOKEN) {
    headers['X-Goldshore-Service-Token'] = env.GS_API_SERVICE_TOKEN;
  }

  return headers;
}

export function fetchGsApi(env: GsApiEnv, path: string, init: RequestInit = {}) {
  const headers = {
    ...buildGsApiHeaders(env),
    ...Object.fromEntries(new Headers(init.headers).entries()),
  };

  if (env.API_SERVICE && !env.API_ORIGIN && !env.GS_API_URL) {
    return env.API_SERVICE.fetch(new Request(new URL(path, SERVICE_BINDING_ORIGIN), {
      ...init,
      headers,
    }));
  }

  return fetch(new URL(path, getGsApiBaseUrl(env)), {
    ...init,
    headers,
  });
}
