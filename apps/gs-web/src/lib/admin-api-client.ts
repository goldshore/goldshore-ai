export type AdminApiErrorKind =
  | 'auth'
  | 'forbidden'
  | 'upstream'
  | 'html'
  | 'network'
  | 'invalid-json'
  | 'unknown';

export type AdminApiError = {
  kind: AdminApiErrorKind;
  status: number;
  message: string;
  requestId?: string;
  contentType?: string;
  location?: string;
};

export type AdminApiResult<T> =
  | { ok: true; status: number; data: T; response: Response }
  | { ok: false; status: number; error: AdminApiError; response?: Response };

const looksLikeHtml = (contentType: string, body: string) =>
  contentType.includes('text/html') || /^\s*<!doctype html|^\s*<html/i.test(body);

const classify = (status: number, html: boolean): AdminApiErrorKind => {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (html) return 'html';
  if (status === 500 || status === 502 || status === 503 || status === 504 || status === 522) return 'upstream';
  return 'unknown';
};

const defaultMessage = (status: number, kind: AdminApiErrorKind) => {
  if (kind === 'auth') return 'Authentication is required. Sign in again and retry.';
  if (kind === 'forbidden') return 'Your current role is not authorized for this operation.';
  if (kind === 'html') return 'The API returned an HTML page instead of JSON. This usually indicates an Access redirect, route miss, or upstream error.';
  if (kind === 'upstream') return `The upstream service is unavailable (${status}).`;
  return `Request failed (${status || 'network error'}).`;
};

export async function adminApi<T = unknown>(input: RequestInfo | URL, init: RequestInit = {}): Promise<AdminApiResult<T>> {
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    if (!headers.has('accept')) headers.set('accept', 'application/json');
    if (init.body && !headers.has('content-type') && typeof init.body === 'string') headers.set('content-type', 'application/json');
    response = await fetch(input, { ...init, headers, redirect: 'manual' });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: {
        kind: 'network',
        status: 0,
        message: error instanceof Error ? error.message : 'Network request failed.',
      },
    };
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const location = response.headers.get('location') || undefined;
  const requestId = response.headers.get('x-request-id') || response.headers.get('cf-ray') || undefined;
  const body = await response.text();
  const html = looksLikeHtml(contentType, body);

  if (response.status >= 300 && response.status < 400) {
    return {
      ok: false,
      status: response.status,
      response,
      error: {
        kind: 'auth',
        status: response.status,
        message: 'The request was redirected before it reached the JSON API. Cloudflare Access or route configuration should be checked.',
        contentType,
        location,
        requestId,
      },
    };
  }

  let parsed: any = null;
  if (!html && body.trim()) {
    try {
      parsed = JSON.parse(body);
    } catch {
      if (response.ok) {
        return {
          ok: false,
          status: 502,
          response,
          error: {
            kind: 'invalid-json',
            status: 502,
            message: 'The API response was not valid JSON.',
            contentType,
            requestId,
          },
        };
      }
    }
  }

  if (!response.ok || html) {
    const kind = classify(response.status, html);
    const apiMessage = parsed?.error?.message || parsed?.error || parsed?.message;
    return {
      ok: false,
      status: response.status,
      response,
      error: {
        kind,
        status: response.status,
        message: typeof apiMessage === 'string' ? apiMessage : defaultMessage(response.status, kind),
        contentType,
        location,
        requestId,
      },
    };
  }

  return { ok: true, status: response.status, data: parsed as T, response };
}

export const adminApiMessage = (result: AdminApiResult<unknown>) =>
  result.ok ? '' : result.error.requestId ? `${result.error.message} Request ${result.error.requestId}.` : result.error.message;
