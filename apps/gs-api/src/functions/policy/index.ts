/**
 * Policy Functions
 *
 * Business logic for governance, compliance, and access policies
 */

export interface PolicyRequest {
  userId: string;
  action: string;
  resource: string;
  context?: Record<string, any>;
}

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

export async function evaluatePolicy(
  request: PolicyRequest,
  db: any
): Promise<PolicyResult> {
  const { userId, action, resource, context = {} } = request;

  const policy = await db
    .prepare('SELECT * FROM policies WHERE resource = ? AND action = ?')
    .bind(resource, action)
    .first();

  if (!policy) {
    return { allowed: false, reason: 'No policy defined' };
  }

  const user = await db
    .prepare('SELECT * FROM admin_users WHERE id = ?')
    .bind(userId)
    .first();

  if (!user || !user.active) {
    return { allowed: false, reason: 'User not active' };
  }

  const userRoles = JSON.parse(user.roles || '[]');

  for (const roleId of userRoles) {
    const role = await db
      .prepare('SELECT * FROM admin_roles WHERE id = ?')
      .bind(roleId)
      .first();

    if (!role) continue;

    const permissions = JSON.parse(role.permissions || '[]');
    const requiredPerms = JSON.parse(policy.required_permissions || '[]');

    if (requiredPerms.every((perm: string) => permissions.includes(perm))) {
      return { allowed: true };
    }
  }

  return { allowed: false, reason: 'Insufficient permissions' };
}

export async function enforceRateLimit(
  userId: string,
  action: string,
  env: any
): Promise<PolicyResult> {
  const kv = env.KV;
  const key = `rate-limit:${userId}:${action}`;
  const limit = 100;
  const window = 3600; // 1 hour in seconds

  const current = await kv.get(key);
  const count = current ? parseInt(current) + 1 : 1;

  if (count > limit) {
    return {
      allowed: false,
      reason: `Rate limit exceeded (${limit}/${window}s)`,
    };
  }

  await kv.put(key, count.toString(), { expirationTtl: window });
  return { allowed: true };
}

export async function checkResourceQuota(
  userId: string,
  resourceType: string,
  db: any,
  env: any
): Promise<PolicyResult> {
  const quota = await db
    .prepare(
      `SELECT quota FROM user_quotas WHERE user_id = ? AND resource_type = ?`
    )
    .bind(userId, resourceType)
    .first();

  if (!quota) {
    return { allowed: true };
  }

  const usage = await db
    .prepare(
      `SELECT COUNT(*) as count FROM user_resources WHERE user_id = ? AND resource_type = ?`
    )
    .bind(userId, resourceType)
    .first();

  if (usage.count >= quota.quota) {
    return {
      allowed: false,
      reason: `Quota exceeded for ${resourceType}`,
    };
  }

  return { allowed: true };
}

export async function auditPolicyDecision(
  request: PolicyRequest,
  result: PolicyResult,
  db: any
): Promise<void> {
  const { userId, action, resource } = request;

  await db
    .prepare(
      `
      INSERT INTO policy_audit_logs (id, user_id, action, resource, decision, timestamp)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
    )
    .bind(
      crypto.randomUUID(),
      userId,
      action,
      resource,
      result.allowed ? 'ALLOWED' : 'DENIED'
    )
    .run();
}

export async function getPoliciesForResource(
  resource: string,
  db: any
): Promise<any[]> {
  const policies = await db
    .prepare('SELECT * FROM policies WHERE resource = ? ORDER BY created_at DESC')
    .bind(resource)
    .all();

  return policies.results || [];
}

export async function createPolicy(
  resource: string,
  action: string,
  requiredPermissions: string[],
  db: any
): Promise<string> {
  const id = crypto.randomUUID();

  await db
    .prepare(
      `
      INSERT INTO policies (id, resource, action, required_permissions, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
    )
    .bind(id, resource, action, JSON.stringify(requiredPermissions))
    .run();

  return id;
}
