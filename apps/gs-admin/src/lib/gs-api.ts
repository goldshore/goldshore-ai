type GsApiEnv = {
  API_ORIGIN?: string;
  GS_API_SERVICE_TOKEN?: string;
};

export function getGsApiBaseUrl(env: GsApiEnv) {
  return env.API_ORIGIN || 'https://api.goldshore.ai';
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
