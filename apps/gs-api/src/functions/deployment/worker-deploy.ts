/**
 * Worker Deployment Function
 */

export async function deployWorker(
  workerName: string,
  scriptContent: string,
  env: any
): Promise<{ success: boolean; workerName: string; timestamp: string }> {
  try {
    // Call Cloudflare API to deploy worker
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${workerName}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_BUILD_API_TOKEN}`,
          'Content-Type': 'application/javascript',
        },
        body: scriptContent,
      }
    );

    if (!response.ok) {
      throw new Error(`Deployment failed: ${response.statusText}`);
    }

    const db = env.PLATFORM_DB;
    const deploymentId = crypto.randomUUID();
    
    await db.prepare(
      'INSERT INTO worker_deployments (id, worker_name, status, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
    ).bind(deploymentId, workerName, 'success').run();

    return {
      success: true,
      workerName,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      workerName,
      timestamp: new Date().toISOString(),
    };
  }
}
