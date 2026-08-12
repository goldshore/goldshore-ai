/**
 * Cloudflare Deployment Maintenance
 *
 * Functions for managing Cloudflare deployments, monitoring, and maintenance tasks
 */

export interface DeploymentStatus {
  workerName: string;
  status: 'active' | 'deploying' | 'failed' | 'rollback';
  version: string;
  timestamp: string;
  uptime: number;
}

export interface HealthMetrics {
  cpuUsage: number;
  memoryUsage: number;
  requestCount: number;
  errorRate: number;
  averageLatency: number;
}

export async function getWorkerDeploymentStatus(
  workerName: string,
  env: any
): Promise<DeploymentStatus> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${workerName}`,
      {
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_BUILD_API_TOKEN}`,
        },
      }
    );

    const data = await response.json();

    if (!data.success) {
      return {
        workerName,
        status: 'failed',
        version: 'unknown',
        timestamp: new Date().toISOString(),
        uptime: 0,
      };
    }

    return {
      workerName,
      status: 'active',
      version: data.result.main_module.name || 'unknown',
      timestamp: new Date().toISOString(),
      uptime: 100,
    };
  } catch (error) {
    return {
      workerName,
      status: 'failed',
      version: 'unknown',
      timestamp: new Date().toISOString(),
      uptime: 0,
    };
  }
}

export async function checkWorkerHealth(
  workerName: string,
  env: any
): Promise<HealthMetrics> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/analytics/engine/readings`,
      {
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_BUILD_API_TOKEN}`,
        },
      }
    );

    const data = await response.json();

    if (!data.success) {
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        requestCount: 0,
        errorRate: 0,
        averageLatency: 0,
      };
    }

    const readings = data.result;
    return {
      cpuUsage: readings.cpu_ms || 0,
      memoryUsage: readings.memory_kb || 0,
      requestCount: readings.requests || 0,
      errorRate: readings.error_rate || 0,
      averageLatency: readings.cpu_ms || 0,
    };
  } catch (error) {
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      requestCount: 0,
      errorRate: 0,
      averageLatency: 0,
    };
  }
}

export async function rollbackWorkerDeployment(
  workerName: string,
  previousVersion: string,
  env: any
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${workerName}/rollback`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_BUILD_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rollback_to: previousVersion,
        }),
      }
    );

    const data = await response.json();
    return data.success || false;
  } catch {
    return false;
  }
}

export async function monitorWorkerErrors(
  workerName: string,
  db: any,
  env: any
): Promise<any[]> {
  try {
    const errors = await db
      .prepare(
        `
        SELECT * FROM worker_errors 
        WHERE worker_name = ? 
        AND timestamp > datetime('now', '-1 hour')
        ORDER BY timestamp DESC
        LIMIT 50
      `
      )
      .bind(workerName)
      .all();

    return errors.results || [];
  } catch {
    return [];
  }
}

export async function cleanupOldDeployments(
  workerName: string,
  keepCount: number,
  db: any
): Promise<number> {
  try {
    const result = await db
      .prepare(
        `
        DELETE FROM worker_deployments 
        WHERE worker_name = ? 
        AND id NOT IN (
          SELECT id FROM worker_deployments 
          WHERE worker_name = ? 
          ORDER BY timestamp DESC 
          LIMIT ?
        )
      `
      )
      .bind(workerName, workerName, keepCount)
      .run();

    return result.meta.changes || 0;
  } catch {
    return 0;
  }
}

export async function recordDeploymentEvent(
  workerName: string,
  eventType: string,
  details: Record<string, any>,
  db: any
): Promise<string> {
  const id = crypto.randomUUID();

  await db
    .prepare(
      `
      INSERT INTO deployment_events (id, worker_name, event_type, details, timestamp)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
    )
    .bind(id, workerName, eventType, JSON.stringify(details))
    .run();

  return id;
}

export async function getDeploymentHistory(
  workerName: string,
  limit: number,
  db: any
): Promise<any[]> {
  const history = await db
    .prepare(
      `
      SELECT * FROM deployment_events
      WHERE worker_name = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `
    )
    .bind(workerName, limit)
    .all();

  return history.results || [];
}

export async function listAllWorkerDeployments(
  env: any
): Promise<DeploymentStatus[]> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts`,
      {
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_BUILD_API_TOKEN}`,
        },
      }
    );

    const data = await response.json();

    if (!data.success) {
      return [];
    }

    return data.result.map((worker: any) => ({
      workerName: worker.main_module?.name || 'unknown',
      status: 'active' as const,
      version: worker.main_module?.name || 'unknown',
      timestamp: worker.created_on || new Date().toISOString(),
      uptime: 100,
    }));
  } catch {
    return [];
  }
}
