export const API_SCHEMA_VERSION = '2026-02-01';
export const API_VERSION_HEADER = 'x-gs-api-version';

export const withContractHeaders = <T>(
  payload: T,
  runtimeVersion: string | undefined
): T & { schemaVersion: string; apiVersion: string } => ({
  ...payload,
  schemaVersion: API_SCHEMA_VERSION,
  apiVersion: runtimeVersion ?? 'v1'
});
