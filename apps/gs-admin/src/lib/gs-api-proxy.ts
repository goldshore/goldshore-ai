type GsApiFetcher = { fetch: (request: Request) => Promise<Response> };

type GsApiEnv = {
  API?: GsApiFetcher;
  GS_API?: GsApiFetcher;
  GS_API_ORIGIN?: string;
};

const ACCESS_ASSERTION_HEADER = 'CF-Access-Jwt-Assertion';

export function getGsApiBaseUrl(env: GsApiEnv): string {
  return env.GS_API_ORIGIN ?? 'https://api.goldshore.ai';
}

export async function proxyToGsApi(env: GsApiEnv, incomingRequest: Request, path: string): Promise<Response> {
  const url = new URL(incomingRequest.url);
  const target = `${getGsApiBaseUrl(env)}${path}${url.search}`;
  const headers = new Headers(incomingRequest.headers);
  const accessAssertion = incomingRequest.headers.get(ACCESS_ASSERTION_HEADER);
  if (accessAssertion) headers.set(ACCESS_ASSERTION_HEADER, accessAssertion);

  const init: RequestInit = {
    method: incomingRequest.method,
    headers,
  };
  if (!['GET', 'HEAD'].includes(incomingRequest.method)) {
    init.body = await incomingRequest.arrayBuffer();
  }

  const request = new Request(target, init);
  const service = env.GS_API ?? env.API;
  return service ? service.fetch(request) : fetch(request);
}
