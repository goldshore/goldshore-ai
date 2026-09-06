/**
 * Error Classification Middleware
 *
 * Classifies upstream failures (service binding errors, network issues, misconfiguration)
 * for better observability and debugging.
 */

export type UpstreamFailureType =
  | 'binding-unreachable'
  | 'binding-misconfigured'
  | 'upstream-error-response'
  | 'unexpected-exception';

export interface ClassifiedError {
  failureType: Exclude<UpstreamFailureType, 'upstream-error-response'>;
  reason: string;
}

export function classifyApiException(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes('is not a function')
    || normalizedMessage.includes('service binding')
    || normalizedMessage.includes('binding')
  ) {
    return {
      failureType: 'binding-misconfigured',
      reason: message,
    };
  }

  if (
    normalizedMessage.includes('network')
    || normalizedMessage.includes('connection')
    || normalizedMessage.includes('unreachable')
    || normalizedMessage.includes('refused')
    || normalizedMessage.includes('timed out')
  ) {
    return {
      failureType: 'binding-unreachable',
      reason: message,
    };
  }

  return {
    failureType: 'unexpected-exception',
    reason: message,
  };
}

export function logApiFailure(
  requestId: string,
  pathname: string,
  failureType: UpstreamFailureType,
  details: Record<string, unknown> = {},
): void {
  console.error(
    JSON.stringify({
      event: 'api_fetch_failure',
      requestId,
      pathname,
      failureType,
      ...details,
    }),
  );
}
