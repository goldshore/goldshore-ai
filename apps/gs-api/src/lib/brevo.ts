import type { Env } from '../types';

const BREVO_API_ORIGIN = 'https://api.brevo.com/v3';

type BrevoEnv = Pick<Env, 'BREVO_API_KEY'>;

export type BrevoContactInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  lifecycleStage?: 'subscriber' | 'lead' | 'mql' | 'sql' | 'customer' | 'partner';
  leadSource?: string;
  interests?: string[];
  consentAt?: string;
  consentSource?: string;
  consentVersion?: string;
  listIds?: number[];
};

export type BrevoResult =
  | { configured: false; ok: false; status: 0; code: 'BREVO_NOT_CONFIGURED' }
  | { configured: true; ok: boolean; status: number; code: string };

const getBrevoApiKey = async (env: BrevoEnv) => {
  if (!env.BREVO_API_KEY) return null;
  const value = await env.BREVO_API_KEY.get();
  return value.trim() || null;
};

const requestBrevo = async (
  env: BrevoEnv,
  path: string,
  init: RequestInit = {},
): Promise<BrevoResult> => {
  const apiKey = await getBrevoApiKey(env);
  if (!apiKey) return { configured: false, ok: false, status: 0, code: 'BREVO_NOT_CONFIGURED' };

  try {
    const response = await fetch(`${BREVO_API_ORIGIN}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    return {
      configured: true,
      ok: response.ok,
      status: response.status,
      code: response.ok ? 'OK' : `BREVO_HTTP_${response.status}`,
    };
  } catch {
    return { configured: true, ok: false, status: 503, code: 'BREVO_UNAVAILABLE' };
  }
};

export const verifyBrevoConnection = (env: BrevoEnv) => requestBrevo(env, '/account');

export const upsertBrevoContact = async (
  env: BrevoEnv,
  input: BrevoContactInput,
): Promise<BrevoResult> => {
  const attributes: Record<string, string | string[]> = {};
  if (input.firstName) attributes.FIRSTNAME = input.firstName;
  if (input.lastName) attributes.LASTNAME = input.lastName;
  if (input.lifecycleStage) attributes.LIFECYCLE_STAGE = input.lifecycleStage;
  if (input.leadSource) attributes.LEAD_SOURCE = input.leadSource;
  if (input.interests?.length) attributes.INTERESTS = input.interests;
  if (input.consentAt) attributes.CONSENT_AT = input.consentAt;
  if (input.consentSource) attributes.CONSENT_SOURCE = input.consentSource;
  if (input.consentVersion) attributes.CONSENT_VERSION = input.consentVersion;

  return requestBrevo(env, '/contacts', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      attributes,
      listIds: input.listIds ?? [],
      updateEnabled: true,
      emailBlacklisted: false,
    }),
  });
};

export const suppressBrevoContact = (env: BrevoEnv, email: string) =>
  requestBrevo(env, `/contacts/${encodeURIComponent(email)}`, {
    method: 'PUT',
    body: JSON.stringify({ emailBlacklisted: true }),
  });
