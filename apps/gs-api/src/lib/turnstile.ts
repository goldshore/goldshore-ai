export interface TurnstileValidationResult {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  error_codes?: string[];
  cData?: string;
}

export async function validateTurnstileToken(
  token: string,
  secretKey: string,
  remoteIp?: string,
): Promise<TurnstileValidationResult> {
  if (!token || !secretKey) {
    return {
      success: false,
      error_codes: ['missing_token_or_secret'],
    };
  }

  try {
    const body: Record<string, string> = {
      secret: secretKey,
      response: token,
    };

    if (remoteIp) {
      body.remoteip = remoteIp;
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        success: false,
        error_codes: [`http_${response.status}`],
      };
    }

    const result = (await response.json()) as TurnstileValidationResult;
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Turnstile validation error:', errorMsg);
    return {
      success: false,
      error_codes: ['validation_error', errorMsg],
    };
  }
}

export function extractClientIp(request: Request): string | undefined {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    undefined
  );
}

export async function validateFormTurnstile(
  formData: FormData,
  secretKey?: string,
  request?: Request,
): Promise<{ valid: boolean; error?: string }> {
  // Skip validation if no secret key is configured
  if (!secretKey) {
    return { valid: true };
  }

  const token = formData.get('cf-turnstile-response');
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      error: 'Turnstile token is required',
    };
  }

  const remoteIp = request ? extractClientIp(request) : undefined;
  const result = await validateTurnstileToken(token, secretKey, remoteIp);

  if (!result.success) {
    const errorMsg = result.error_codes?.join(', ') || 'Turnstile validation failed';
    return {
      valid: false,
      error: errorMsg,
    };
  }

  return { valid: true };
}
