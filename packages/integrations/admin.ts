import type { AuthTokenConfig } from './auth';
import { createAuthTokenManager } from './auth';
import { type AuditLogger, createAuditLogger } from './audit';
import { type HttpClient, createHttpClient } from './http';

export type AdminServiceResult<T = unknown> = {
  ok: boolean;
  payload: T | { error: string };
};

export type AdminServiceConfig = {
  apiBaseUrl: string;
  auth?: AuthTokenConfig;
  auditEndpoint?: string;
  actor?: string;
  logger?: Pick<Console, 'info' | 'warn' | 'error'>;
  httpClient?: HttpClient;
  auditLogger?: AuditLogger;
};

export const createAdminService = (config: AdminServiceConfig) => {
  const logger = config.logger ?? console;
  const authTokenManager = config.auth ? createAuthTokenManager(config.auth) : undefined;

  const httpClient =
    config.httpClient ??
    createHttpClient({
      baseUrl: config.apiBaseUrl,
      authTokenManager,
      logger
    });

  const auditLogger =
    config.auditLogger ??
    createAuditLogger({
      endpoint: config.auditEndpoint,
      httpClient,
      logger
    });

  const parseResponse = async <T>(response: Response): Promise<AdminServiceResult<T>> => {
    try {
      const payload = (await response.json()) as T;
      return { ok: response.ok, payload };
    } catch (error) {
      return { ok: response.ok, payload: { error: 'Invalid JSON response' } };
    }
  };

  const performAdminAction = async <T>(
    action: string,
    target: string,
    requestFn: () => Promise<Response>,
    metadata?: Record<string, unknown>
  ): Promise<AdminServiceResult<T>> => {
    let status: 'success' | 'failure' = 'success';

    try {
      const response = await requestFn();
      const result = await parseResponse<T>(response);
      if (!response.ok) {
        status = 'failure';
      }
      return result;
    } catch (error) {
      status = 'failure';
      logger.error('[admin] request failed', { action, target, error });
      return { ok: false, payload: { error: 'Request failed' } };
    } finally {
      await auditLogger.logAdminAction({
        action,
        actor: config.actor,
        target,
        status,
        metadata
      });
    }
  };

  const getSystemInfo = async () => {
    const result = await performAdminAction(
      'system.info.read',
      'system',
      () => httpClient.get('/system/info', { cache: 'no-store' })
    );

    return result.ok ? result.payload : null;
  };

  const listDnsRecords = async () =>
    performAdminAction('dns.records.list', 'dns', () => httpClient.get('/dns/records', { cache: 'no-store' }));

  const updateDnsRecord = async (recordId: string, content: string) =>
    performAdminAction(
      'dns.records.update',
      `dns:${recordId}`,
      () => httpClient.put(`/dns/records/${recordId}`, { content }),
      { recordId }
    );

  const getWorkersStatus = async () =>
    performAdminAction('workers.status.read', 'workers', () => httpClient.get('/workers/status', { cache: 'no-store' }));

  const listPagesProjects = async () =>
    performAdminAction('pages.projects.list', 'pages', () => httpClient.get('/pages/projects', { cache: 'no-store' }));

  const listKvNamespaces = async () =>
    performAdminAction('kv.namespaces.list', 'kv', () => httpClient.get('/kv/namespaces', { cache: 'no-store' }));

  const listR2Buckets = async () =>
    performAdminAction('r2.buckets.list', 'r2', () => httpClient.get('/r2/buckets', { cache: 'no-store' }));

  const listD1Databases = async () =>
    performAdminAction('d1.databases.list', 'd1', () => httpClient.get('/d1/databases', { cache: 'no-store' }));

  const listAccessPolicies = async (appId: string) =>
    performAdminAction(
      'access.policies.list',
      `access:${appId}`,
      () => httpClient.get(`/access/policies?appId=${encodeURIComponent(appId)}`, { cache: 'no-store' }),
      { appId }
    );

  return {
    getSystemInfo,
    listDnsRecords,
    updateDnsRecord,
    getWorkersStatus,
    listPagesProjects,
    listKvNamespaces,
    listR2Buckets,
    listD1Databases,
    listAccessPolicies
  };
};
