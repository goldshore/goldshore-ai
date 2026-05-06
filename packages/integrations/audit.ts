import type { HttpLogger } from './http';

export type AuditLogEntry = {
  action: string;
  actor?: string;
  target?: string;
  status?: 'success' | 'failure';
  metadata?: Record<string, unknown>;
  timestamp?: string;
};

export type AuditLoggerConfig = {
  endpoint?: string;
  httpClient?: {
    post: (path: string, body?: unknown) => Promise<Response>;
  };
  logger?: HttpLogger;
};

export const createAuditLogger = (config: AuditLoggerConfig) => {
  const logger = config.logger ?? console;

  const logAdminAction = async (entry: AuditLogEntry) => {
    const payload: AuditLogEntry = {
      ...entry,
      timestamp: entry.timestamp ?? new Date().toISOString()
    };

    logger.info('[audit] admin action', payload);

    if (config.endpoint && config.httpClient) {
      const response = await config.httpClient.post(config.endpoint, payload);
      if (!response.ok) {
        logger.warn('[audit] failed to persist audit log', { status: response.status });
      }
    }
  };

  return { logAdminAction };
};
export type AuditLogger = ReturnType<typeof createAuditLogger>;
