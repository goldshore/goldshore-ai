type GsApiEnv = {
  API_ORIGIN?: string;
};

export function getGsApiBaseUrl(env: GsApiEnv) {
  return env.API_ORIGIN || 'https://api.goldshore.ai';
}

export function buildGsApiHeaders(request: Request) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const authorization = request.headers.get('Authorization');
  const accessJwt = request.headers.get('CF-Access-Jwt-Assertion');

  if (authorization) {
    headers.Authorization = authorization;
  }

  if (accessJwt) {
    headers['CF-Access-Jwt-Assertion'] = accessJwt;
  }

  return headers;
}
