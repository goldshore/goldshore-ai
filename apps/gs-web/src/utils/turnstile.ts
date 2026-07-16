export const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type TurnstileSiteverifyResponse = {
  success?: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  'error-codes'?: string[];
};

export type TurnstileVerificationFailure = {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export const verifyTurnstileToken = async (
  secret: string | undefined,
  token: string,
  remoteip?: string,
  fetcher: typeof fetch = fetch,
): Promise<TurnstileVerificationFailure | null> => {
  const trimmedSecret = secret?.trim();
  if (!trimmedSecret) {
    return {
      status: 503,
      code: 'turnstile_unconfigured',
      message: 'Verification unavailable.',
    };
  }

  if (!token) {
    return {
      status: 403,
      code: 'turnstile_required',
      message: 'Verification required.',
    };
  }

  const body = new URLSearchParams({
    secret: trimmedSecret,
    response: token,
  });
  if (remoteip) body.set('remoteip', remoteip);

  const response = await fetcher(TURNSTILE_SITEVERIFY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    return {
      status: 502,
      code: 'turnstile_unavailable',
      message: 'Verification unavailable.',
    };
  }

  const result = (await response.json()) as TurnstileSiteverifyResponse;
  if (result.success !== true) {
    return {
      status: 403,
      code: 'turnstile_failed',
      message: 'Verification failed.',
      details: {
        errors: result['error-codes'] ?? [],
      },
    };
  }

  return null;
};
