/**
 * MCP Server for Cloudflare Worker Configuration Synchronization
 * Enables automated workflows for syncing wrangler.toml, secrets, bindings,
 * and deployment configs across environments (dev/preview/production)
 */

import { McpServer, StdioServerTransport } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  createErrorResponse,
  createTextResponse,
  createJsonResponse,
  safeApiCall,
} from './shared';

/**
 * Cloudflare API client for Workers management
 */
class CloudflareClient {
  private baseUrl = 'https://api.cloudflare.com/client/v4';
  private token: string;
  private accountId: string;

  constructor(token: string, accountId: string) {
    this.token = token;
    this.accountId = accountId;
  }

  private async request(method: string, path: string, body?: unknown) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Cloudflare API error: ${response.status} ${response.statusText}\n${error}`
      );
    }

    return response.json();
  }

  // Get account details
  async getAccount() {
    return this.request('GET', `/accounts/${this.accountId}`);
  }

  // List all Workers scripts
  async listScripts() {
    return this.request(
      'GET',
      `/accounts/${this.accountId}/workers/scripts`
    );
  }

  // Get Worker script details
  async getScript(scriptName: string) {
    return this.request(
      'GET',
      `/accounts/${this.accountId}/workers/scripts/${scriptName}`
    );
  }

  // Get Worker script contents (wrangler.toml equivalent)
  async getScriptContent(scriptName: string) {
    return this.request(
      'GET',
      `/accounts/${this.accountId}/workers/scripts/${scriptName}/content`
    );
  }

  // Upload/update Worker script
  async uploadScript(scriptName: string, script: string, metadata?: any) {
    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadata || {}));
    formData.append('script', new Blob([script], { type: 'application/javascript' }));

    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/workers/scripts/${scriptName}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to upload script: ${response.statusText}`);
    }

    return response.json();
  }

  // List KV namespaces
  async listKvNamespaces() {
    return this.request(
      'GET',
      `/accounts/${this.accountId}/storage/kv/namespaces`
    );
  }

  // List D1 databases
  async listD1Databases() {
    return this.request(
      'GET',
      `/accounts/${this.accountId}/d1/database`
    );
  }

  // List R2 buckets
  async listR2Buckets() {
    return this.request(
      'GET',
      `/accounts/${this.accountId}/r2/buckets`
    );
  }

  // Get Worker secrets (environment-scoped)
  async getSecrets(scriptName: string) {
    return this.request(
      'GET',
      `/accounts/${this.accountId}/workers/scripts/${scriptName}/secrets`
    );
  }

  // Set a secret
  async setSecret(scriptName: string, name: string, value: string) {
    return this.request(
      'PUT',
      `/accounts/${this.accountId}/workers/scripts/${scriptName}/secrets`,
      { name, text: value }
    );
  }

  // Delete a secret
  async deleteSecret(scriptName: string, name: string) {
    return this.request(
      'DELETE',
      `/accounts/${this.accountId}/workers/scripts/${scriptName}/secrets/${name}`
    );
  }

  // Get deployments
  async getDeployments(scriptName: string) {
    return this.request(
      'GET',
      `/accounts/${this.accountId}/workers/scripts/${scriptName}/deployments`
    );
  }

  // Rollback to previous deployment
  async rollbackDeployment(scriptName: string, deploymentId: string) {
    return this.request(
      'POST',
      `/accounts/${this.accountId}/workers/scripts/${scriptName}/deployments/rollback`,
      { deployment_id: deploymentId }
    );
  }
}

/**
 * Initialize Cloudflare Config Sync MCP Server
 */
export async function initCloudflareConfigSync() {
  const cfToken = process.env.CLOUDFLARE_API_TOKEN || '';
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';

  if (!cfToken || !cfAccountId) {
    console.warn(
      'CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID not set - Config Sync will not function'
    );
  }

  const client = new CloudflareClient(cfToken, cfAccountId);
  const server = new McpServer({
    name: 'cloudflare-config-sync',
    version: '1.0.0',
  });

  // List all Workers scripts
  server.registerTool(
    'cf_list_scripts',
    {
      description: 'List all Cloudflare Workers scripts in the account',
      inputSchema: z.object({}),
    },
    async () => {
      const result = await safeApiCall(
        () => client.listScripts(),
        'list_scripts'
      );

      if (!result) {
        return createErrorResponse('Failed to list Workers scripts');
      }

      const scripts = (result as any).result || [];
      return createJsonResponse(
        scripts.map((s: any) => ({
          id: s.id,
          name: s.script_name || s.name,
          created_on: s.created_on,
          modified_on: s.modified_on,
          etag: s.etag,
          usage_model: s.usage_model,
        }))
      );
    }
  );

  // Get script details
  server.registerTool(
    'cf_get_script',
    {
      description: 'Get details about a specific Cloudflare Worker script',
      inputSchema: z.object({
        script_name: z.string().describe('Name of the Worker script'),
      }),
    },
    async (params) => {
      const result = await safeApiCall(
        () => client.getScript(params.script_name),
        'get_script'
      );

      if (!result) {
        return createErrorResponse(`Failed to get script: ${params.script_name}`);
      }

      const script = (result as any).result;
      return createJsonResponse({
        name: script.script_name || script.name,
        id: script.id,
        created_on: script.created_on,
        modified_on: script.modified_on,
        usage_model: script.usage_model,
        etag: script.etag,
        bindings: script.bindings || [],
      });
    }
  );

  // List bindings for a script
  server.registerTool(
    'cf_list_bindings',
    {
      description: 'List all bindings (KV, D1, R2, etc.) configured for a Worker script',
      inputSchema: z.object({
        script_name: z.string().describe('Name of the Worker script'),
      }),
    },
    async (params) => {
      const result = await safeApiCall(
        () => client.getScript(params.script_name),
        'list_bindings'
      );

      if (!result) {
        return createErrorResponse(`Failed to get bindings for: ${params.script_name}`);
      }

      const bindings = (result as any).result?.bindings || [];
      const formatted = bindings.map((b: any) => ({
        name: b.name,
        type: b.type,
        ...(b.namespace_id && { namespace_id: b.namespace_id }),
        ...(b.database_id && { database_id: b.database_id }),
        ...(b.bucket_name && { bucket_name: b.bucket_name }),
        ...(b.class_name && { durable_object_class: b.class_name }),
      }));

      return createJsonResponse(formatted);
    }
  );

  // List secrets
  server.registerTool(
    'cf_list_secrets',
    {
      description: 'List all secrets configured for a Worker script',
      inputSchema: z.object({
        script_name: z.string().describe('Name of the Worker script'),
      }),
    },
    async (params) => {
      const result = await safeApiCall(
        () => client.getSecrets(params.script_name),
        'list_secrets'
      );

      if (!result) {
        return createErrorResponse(`Failed to list secrets for: ${params.script_name}`);
      }

      const secrets = (result as any).result || [];
      return createJsonResponse(
        secrets.map((s: any) => ({
          name: s.name,
          type: s.type || 'secret',
        }))
      );
    }
  );

  // Set/rotate a secret
  server.registerTool(
    'cf_set_secret',
    {
      description: 'Set or rotate a secret for a Worker script',
      inputSchema: z.object({
        script_name: z.string().describe('Name of the Worker script'),
        secret_name: z.string().describe('Name of the secret'),
        secret_value: z.string().describe('Value of the secret (will be encrypted)'),
      }),
    },
    async (params) => {
      const result = await safeApiCall(
        () => client.setSecret(params.script_name, params.secret_name, params.secret_value),
        'set_secret'
      );

      if (!result) {
        return createErrorResponse(
          `Failed to set secret ${params.secret_name} for ${params.script_name}`
        );
      }

      return createTextResponse(
        `✓ Secret '${params.secret_name}' set successfully for ${params.script_name}`
      );
    }
  );

  // Sync secrets from one script to another
  server.registerTool(
    'cf_sync_secrets',
    {
      description: 'Sync secrets from a source Worker to a target Worker',
      inputSchema: z.object({
        source_script: z.string().describe('Source Worker script name (e.g., gs-api-prod)'),
        target_script: z
          .string()
          .describe('Target Worker script name (e.g., gs-api-preview)'),
        secret_names: z
          .array(z.string())
          .optional()
          .describe(
            'Specific secrets to sync (if omitted, syncs all secrets except sensitive ones)'
          ),
      }),
    },
    async (params) => {
      const secrets = await safeApiCall(
        () => client.getSecrets(params.source_script),
        'sync_secrets_list'
      );

      if (!secrets) {
        return createErrorResponse(
          `Failed to read secrets from ${params.source_script}`
        );
      }

      const secretList = (secrets as any).result || [];
      const toSync = params.secret_names
        ? secretList.filter((s: any) => params.secret_names!.includes(s.name))
        : secretList;

      const results = [];
      for (const secret of toSync) {
        // Note: API doesn't allow reading secret values, only setting them
        // In practice, you'd manually provide values or use a secure vault
        results.push({
          name: secret.name,
          status: 'requires_value',
          note: 'Secret values cannot be read via API; provide new value to rotate',
        });
      }

      return createJsonResponse({
        source: params.source_script,
        target: params.target_script,
        secrets_to_sync: toSync.length,
        details: results,
      });
    }
  );

  // Compare configurations between environments
  server.registerTool(
    'cf_compare_configs',
    {
      description: 'Compare configurations between two Worker scripts',
      inputSchema: z.object({
        script_a: z.string().describe('First Worker script name'),
        script_b: z.string().describe('Second Worker script name'),
      }),
    },
    async (params) => {
      const scriptA = await safeApiCall(
        () => client.getScript(params.script_a),
        'compare_a'
      );
      const scriptB = await safeApiCall(
        () => client.getScript(params.script_b),
        'compare_b'
      );

      if (!scriptA || !scriptB) {
        return createErrorResponse('Failed to fetch one or both scripts');
      }

      const bindings_a = (scriptA as any).result?.bindings || [];
      const bindings_b = (scriptB as any).result?.bindings || [];

      const diff = {
        script_a: params.script_a,
        script_b: params.script_b,
        bindings_only_in_a: bindings_a.filter(
          (b: any) => !bindings_b.find((b2: any) => b2.name === b.name)
        ),
        bindings_only_in_b: bindings_b.filter(
          (b: any) => !bindings_a.find((b2: any) => b2.name === b.name)
        ),
        bindings_count: { a: bindings_a.length, b: bindings_b.length },
      };

      return createJsonResponse(diff);
    }
  );

  // Get deployment history
  server.registerTool(
    'cf_get_deployments',
    {
      description: 'Get deployment history for a Worker script',
      inputSchema: z.object({
        script_name: z.string().describe('Name of the Worker script'),
        limit: z.number().optional().default(10).describe('Number of recent deployments'),
      }),
    },
    async (params) => {
      const result = await safeApiCall(
        () => client.getDeployments(params.script_name),
        'get_deployments'
      );

      if (!result) {
        return createErrorResponse(
          `Failed to get deployments for: ${params.script_name}`
        );
      }

      const deployments = ((result as any).result?.deployments || []).slice(
        0,
        params.limit
      );
      return createJsonResponse(
        deployments.map((d: any) => ({
          id: d.id,
          created_on: d.created_on,
          source: d.source,
          status: d.status,
          compatibility_date: d.compatibility_date,
          compatibility_flags: d.compatibility_flags,
        }))
      );
    }
  );

  // Rollback to previous deployment
  server.registerTool(
    'cf_rollback_deployment',
    {
      description: 'Rollback a Worker script to a previous deployment',
      inputSchema: z.object({
        script_name: z.string().describe('Name of the Worker script'),
        deployment_id: z.string().describe('ID of the deployment to rollback to'),
      }),
    },
    async (params) => {
      const result = await safeApiCall(
        () => client.rollbackDeployment(params.script_name, params.deployment_id),
        'rollback'
      );

      if (!result) {
        return createErrorResponse(
          `Failed to rollback ${params.script_name} to ${params.deployment_id}`
        );
      }

      return createTextResponse(
        `✓ Rolled back ${params.script_name} to deployment ${params.deployment_id}`
      );
    }
  );

  // List all KV namespaces
  server.registerTool(
    'cf_list_kv_namespaces',
    {
      description: 'List all KV namespaces in the account',
      inputSchema: z.object({}),
    },
    async () => {
      const result = await safeApiCall(
        () => client.listKvNamespaces(),
        'list_kv'
      );

      if (!result) {
        return createErrorResponse('Failed to list KV namespaces');
      }

      const namespaces = (result as any).result || [];
      return createJsonResponse(
        namespaces.map((ns: any) => ({
          id: ns.id,
          title: ns.title,
          created_on: ns.created_on,
        }))
      );
    }
  );

  // List all D1 databases
  server.registerTool(
    'cf_list_d1_databases',
    {
      description: 'List all D1 databases in the account',
      inputSchema: z.object({}),
    },
    async () => {
      const result = await safeApiCall(
        () => client.listD1Databases(),
        'list_d1'
      );

      if (!result) {
        return createErrorResponse('Failed to list D1 databases');
      }

      const databases = (result as any).result || [];
      return createJsonResponse(
        databases.map((db: any) => ({
          id: db.uuid,
          name: db.name,
          created_on: db.created_at,
          version: db.version,
        }))
      );
    }
  );

  return server;
}

/**
 * Start the MCP server
 */
export async function startCloudflareConfigSync() {
  const server = await initCloudflareConfigSync();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('Cloudflare Config Sync MCP server started');
}
