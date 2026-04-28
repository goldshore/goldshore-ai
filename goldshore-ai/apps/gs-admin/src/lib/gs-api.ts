import type { ServerEnv } from './server-env';

const DEFAULT_BASE_URL = 'https://api.goldshore.ai';

export const getGsApiBaseUrl = (env: ServerEnv): string =>
  env.GS_API_BASE_URL?.trim() || DEFAULT_BASE_URL;

export const buildGsApiHeaders = (request: Request): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const auth = request.headers.get('authorization');
  if (auth) {
    headers.authorization = auth;
  }
  return headers;
};
