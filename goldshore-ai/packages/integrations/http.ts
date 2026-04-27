export type HttpLogger = Pick<Console, 'info' | 'warn' | 'error'>;

export type HttpRetryConfig = {
  retries?: number;
  retryDelayMs?: number;
};

export type HttpClientConfig = HttpRetryConfig & {
  baseUrl: string;
  authTokenManager?: { getToken: () => Promise<string> };
  logger?: HttpLogger;
  fetchFn?: typeof fetch;
};

export type HttpRequestOptions = RequestInit & {
  path?: string;
};

const DEFAULT_RETRY_DELAY_MS = 300;
const DEFAULT_RETRIES = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryResponse = (response: Response) => {
  if (response.status === 408 || response.status === 429) {
    return true;
  }

  return response.status >= 500;
};

export const createHttpClient = (config: HttpClientConfig) => {
  const fetchFn = config.fetchFn ?? fetch;
  const logger = config.logger ?? console;
  const retries = config.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  const request = async (path: string, options: HttpRequestOptions = {}) => {
    const url = new URL(path, config.baseUrl).toString();
    const headers = new Headers(options.headers ?? undefined);

    if (config.authTokenManager) {
      const token = await config.authTokenManager.getToken();
      headers.set('authorization', `Bearer ${token}`);
    }

    const attemptRequest = async (attempt: number): Promise<Response> => {
      logger.info('[http] request', { method: options.method ?? 'GET', url, attempt });
      try {
        const response = await fetchFn(url, { ...options, headers });
        logger.info('[http] response', { status: response.status, url, attempt });
        if (attempt < retries && shouldRetryResponse(response)) {
          await sleep(retryDelayMs * (attempt + 1));
          return attemptRequest(attempt + 1);
        }
        return response;
      } catch (error) {
        logger.warn('[http] request error', { url, attempt, error });
        if (attempt < retries) {
          await sleep(retryDelayMs * (attempt + 1));
          return attemptRequest(attempt + 1);
        }
        throw error;
      }
    };

    return attemptRequest(0);
  };

  return {
    request,
    get: (path: string, options: HttpRequestOptions = {}) => request(path, { ...options, method: 'GET' }),
    post: (path: string, body?: unknown, options: HttpRequestOptions = {}) =>
      request(path, {
        ...options,
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          'content-type': 'application/json',
          ...options.headers
        }
      }),
    put: (path: string, body?: unknown, options: HttpRequestOptions = {}) =>
      request(path, {
        ...options,
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          'content-type': 'application/json',
          ...options.headers
        }
      })
  };
};
export type HttpClient = ReturnType<typeof createHttpClient>;
