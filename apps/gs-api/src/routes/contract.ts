export const API_SCHEMA_VERSION = '2026-02-1';
export const API_VERSION_HEADER = 'x-gs-api-version';

export const withContractHeaders = <T>(
  payload: T,
  runtimeVersion: string | undefined,
): T & { schemaVersion: string; apiVersion: string } => ({
  ...payload,
  schemaVersion: API_SCHEMA_VERSION,
  apiVersion: runtimeVersion ?? 'v1',
});

export const getRuntimeVersion = (
  env?: { API_VERSION?: string; GIT_SHA?: string } | null,
) => env?.API_VERSION ?? env?.GIT_SHA ?? 'v1';
