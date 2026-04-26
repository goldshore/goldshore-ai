import { z } from 'zod';
import {
  AiOrchestrationSchema,
  ApiRuntimeConfigSchema,
  EmailInboxLogsSchema,
  RoutingTableSchema,
  ServiceStatusSchema,
} from './system.ts';

export const SystemSyncContractSchema = z.object({
  ROUTING_TABLE: RoutingTableSchema,
  SERVICE_STATUS: ServiceStatusSchema,
  AI_ORCHESTRATION: AiOrchestrationSchema,
  EMAIL_INBOX_LOGS: EmailInboxLogsSchema.optional().default([]),
});

export const SystemSyncWriteSchema = SystemSyncContractSchema.omit({
  EMAIL_INBOX_LOGS: true,
});

export const LegacyGsApiConfigSchema = z.object({
  maintenanceMode: z.coerce.boolean().optional(),
  maxConcurrency: z.coerce.number().optional(),
  notes: z.string().optional(),
});

export type SystemSyncContract = z.infer<typeof SystemSyncContractSchema>;
export type SystemSyncWritePayload = z.infer<typeof SystemSyncWriteSchema>;

export const parseSystemSyncWritePayload = (input: unknown) =>
  SystemSyncWriteSchema.safeParse(input);

export const parseSystemSyncSnapshot = (input: unknown) =>
  SystemSyncContractSchema.safeParse(input);

export const parseLegacyGsApiConfig = (input: unknown) =>
  LegacyGsApiConfigSchema.safeParse(input);

export const normalizeApiRuntimeConfig = (input: unknown) => {
  const defaults = ApiRuntimeConfigSchema.parse({});

  if (!input || typeof input !== 'object') {
    return defaults;
  }

  const candidate = input as Record<string, unknown>;
  const maxConcurrencyRaw = candidate.maxConcurrency;

  const normalized = {
    maintenanceMode:
      typeof candidate.maintenanceMode === 'boolean'
        ? candidate.maintenanceMode
        : defaults.maintenanceMode,
    maxConcurrency:
      typeof maxConcurrencyRaw === 'number' && Number.isFinite(maxConcurrencyRaw)
        ? Math.min(Math.max(Math.floor(maxConcurrencyRaw), 1), 500)
        : defaults.maxConcurrency,
    notes: typeof candidate.notes === 'string' ? candidate.notes.slice(0, 500) : defaults.notes,
    migratedFromLegacy:
      typeof candidate.migratedFromLegacy === 'boolean'
        ? candidate.migratedFromLegacy
        : defaults.migratedFromLegacy,
  };

  return ApiRuntimeConfigSchema.parse(normalized);
};

export const migrateLegacyApiConfig = (legacyConfig: unknown, existing: unknown) => {
  const normalizedExisting = normalizeApiRuntimeConfig(existing);
  const legacyResult = parseLegacyGsApiConfig(legacyConfig);

  if (!legacyResult.success) {
    return {
      config: normalizedExisting,
      migrated: false,
    };
  }

  const merged = normalizeApiRuntimeConfig({
    ...normalizedExisting,
    ...legacyResult.data,
  });

  const migrated = Boolean(
    !normalizedExisting.migratedFromLegacy &&
      (legacyResult.data.maintenanceMode !== undefined ||
        legacyResult.data.maxConcurrency !== undefined ||
        legacyResult.data.notes !== undefined)
  );

  return {
    config: {
      ...merged,
      migratedFromLegacy: normalizedExisting.migratedFromLegacy || migrated,
    },
    migrated,
  };
};
