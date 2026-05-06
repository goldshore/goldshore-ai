import { z } from "zod";

export const AiOrchestrationSchema = z.object({
  preferred_model: z.enum(["gpt-4o", "gpt-4-turbo", "gemini-1.5-pro", "claude-3-5-sonnet"]),
  agent_modules: z.array(z.string()).default([]),
  queue_concurrency: z.number().min(1).max(50).default(5),
  retry_attempts: z.number().min(0).max(10).default(3),
  cache_ttl_seconds: z.number().default(86400),
  provider_config: z.object({
    temperature: z.number().min(0).max(2).default(0.7),
    max_tokens: z.number().optional()
  }).optional()
});

export type AiOrchestration = z.infer<typeof AiOrchestrationSchema>;
