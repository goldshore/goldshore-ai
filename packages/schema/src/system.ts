import { z } from 'zod';

export const RoutingRoleSchema = z.enum(['ingress', 'alias', 'backend', 'frontend', 'mx-only']);

export const RoutingEntrySchema = z.object({
  role: RoutingRoleSchema,
  worker: z.string().optional(),
  target: z.string().optional(),
  project: z.string().optional(),
  provider: z.string().optional(),
  priority: z.number().int().min(1).default(1),
});

export const RoutingTableSchema = z.record(z.string(), RoutingEntrySchema);

export const ApiRuntimeConfigSchema = z.object({
  maintenanceMode: z.boolean().default(false),
  maxConcurrency: z.number().int().min(1).max(500).default(10),
  notes: z.string().max(500).default(''),
  migratedFromLegacy: z.boolean().default(false),
});

export const ServiceStatusSchema = z.object({
  maintenance_mode: z.boolean().default(false),
  active_services: z.array(z.string()).default([]),
  version: z.string().default('unknown'),
  last_sync: z.string().datetime().optional(),
  api_config: ApiRuntimeConfigSchema.optional(),
});

export const AiOrchestrationSchema = z.object({
  preferred_model: z.string().min(1).default('gpt-4o'),
  agent_modules: z.array(z.string()).default([]),
  queue_concurrency: z.number().int().min(1).max(100).default(5),
  retry_attempts: z.number().int().min(0).max(10).default(3),
});

export const KeyRotationAuditSchema = z.object({
  action: z.literal('rotate_keys'),
  timestamp: z.string().datetime(),
  results: z.array(
    z.object({
      name: z.string(),
      status: z.enum(['success', 'error']),
      error: z.string().optional(),
    }),
  ),
});

export const EmailLogSchema = z.object({
  id: z.string().uuid(),
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  timestamp: z.string().datetime(),
});

export const EmailInboxLogsSchema = z.array(EmailLogSchema).max(100);

export const MasterConfigSchema = z.object({
  ROUTING_TABLE: RoutingTableSchema,
  SERVICE_STATUS: ServiceStatusSchema,
  AI_ORCHESTRATION: AiOrchestrationSchema,
});

export type RoutingTable = z.infer<typeof RoutingTableSchema>;
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;
export type ApiRuntimeConfig = z.infer<typeof ApiRuntimeConfigSchema>;
export type AiOrchestration = z.infer<typeof AiOrchestrationSchema>;
export type MasterConfig = z.infer<typeof MasterConfigSchema>;
export type EmailLog = z.infer<typeof EmailLogSchema>;
