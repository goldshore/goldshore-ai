import {
  AiOrchestrationSchema,
  ApiRuntimeConfigSchema,
  EmailInboxLogsSchema,
  RoutingTableSchema,
  ServiceStatusSchema,
  migrateLegacyApiConfig,
  normalizeApiRuntimeConfig
} from '@goldshore/schema';
import { z } from 'zod';

export type SystemConfig = ReturnType<typeof normalizeApiRuntimeConfig>;

export const DEFAULT_CONFIG = ApiRuntimeConfigSchema.parse({});

export const parseConfig = (input: unknown): SystemConfig => normalizeApiRuntimeConfig(input);

const DEFAULT_SYSTEM_SNAPSHOT = {
  ROUTING_TABLE: RoutingTableSchema.parse({}),
  SERVICE_STATUS: ServiceStatusSchema.parse({
    maintenance_mode: false,
    active_services: [],
    version: 'unknown',
  }),
  AI_ORCHESTRATION: AiOrchestrationSchema.parse({}),
  EMAIL_INBOX_LOGS: EmailInboxLogsSchema.parse([]),
};

const parseWithFallback = <T>(schema: z.ZodType<T>, input: unknown, fallback: T): T => {
  const result = schema.safeParse(input);
  return result.success ? result.data : fallback;
};

export const loadSystemSyncSnapshot = async (kv: KVNamespace) => {
  const [ROUTING_TABLE, SERVICE_STATUS, AI_ORCHESTRATION, EMAIL_INBOX_LOGS] = await Promise.all([
    kv.get('ROUTING_TABLE', 'json'),
    kv.get('SERVICE_STATUS', 'json'),
    kv.get('AI_ORCHESTRATION', 'json'),
    kv.get('EMAIL_INBOX_LOGS', 'json'),
  ]);

  return {
    ROUTING_TABLE: parseWithFallback(RoutingTableSchema, ROUTING_TABLE, DEFAULT_SYSTEM_SNAPSHOT.ROUTING_TABLE),
    SERVICE_STATUS: parseWithFallback(ServiceStatusSchema, SERVICE_STATUS, DEFAULT_SYSTEM_SNAPSHOT.SERVICE_STATUS),
    AI_ORCHESTRATION: parseWithFallback(AiOrchestrationSchema, AI_ORCHESTRATION, DEFAULT_SYSTEM_SNAPSHOT.AI_ORCHESTRATION),
    EMAIL_INBOX_LOGS: parseWithFallback(EmailInboxLogsSchema, EMAIL_INBOX_LOGS, DEFAULT_SYSTEM_SNAPSHOT.EMAIL_INBOX_LOGS),
  };
};

export const resolveServiceStatusWithConfig = async (kv: KVNamespace) => {
  const rawStatus = await kv.get('SERVICE_STATUS', 'json');
  const statusResult = ServiceStatusSchema.safeParse(rawStatus);

  const baseStatus = statusResult.success
    ? statusResult.data
    : ServiceStatusSchema.parse({
        maintenance_mode: false,
        active_services: [],
        version: 'unknown',
      });

  const migration = migrateLegacyApiConfig(
    await kv.get('gs-api:config', 'json'),
    baseStatus.api_config,
  );

  const mergedStatus = {
    ...baseStatus,
    api_config: migration.config,
  };

  if (migration.migrated || !baseStatus.api_config) {
    await kv.put('SERVICE_STATUS', JSON.stringify(mergedStatus));
  }

  return {
    serviceStatus: mergedStatus,
    migrationApplied: migration.migrated,
  };
};
