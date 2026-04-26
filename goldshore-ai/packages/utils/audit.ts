export interface KVNamespaceLike {
  put(key: string, value: string): Promise<void>;
}

export interface AuditLogDetails {
  action: string;
  actor?: string;
  status: "success" | "denied" | "error";
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export const logAuditEvent = async (
  kv: KVNamespaceLike,
  details: AuditLogDetails
) => {
  const timestamp = details.timestamp ?? new Date().toISOString();
  const key = `audit:${timestamp}:${crypto.randomUUID()}`;
  const payload = {
    ...details,
    timestamp
  };
  await kv.put(key, JSON.stringify(payload));
};
