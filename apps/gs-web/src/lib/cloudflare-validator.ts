export interface CloudflareBinding {
  name: string;
  type: 'kv_namespace' | 'd1_database' | 'r2_bucket' | 'service_binding' | 'env_var';
  resource: string;
  status: 'bound' | 'not_bound' | 'error' | 'not_configured';
  lastChecked: string;
  error?: string;
}

export interface CloudflareValidationResult {
  accountId: string;
  projectName: string;
  bindings: CloudflareBinding[];
  summary: {
    totalBindings: number;
    boundBindings: number;
    errorBindings: number;
    unboundBindings: number;
  };
  lastSync: string;
}

export const validateKVBinding = async (
  kvNamespace: Record<string, unknown> | undefined
): Promise<CloudflareBinding> => {
  const binding: CloudflareBinding = {
    name: 'KV',
    type: 'kv_namespace',
    resource: 'gs_admin_kv_001',
    status: 'not_configured',
    lastChecked: new Date().toISOString(),
  };

  if (!kvNamespace) {
    binding.status = 'not_bound';
    binding.error = 'KV namespace not available in runtime';
    return binding;
  }

  try {
    // Try a simple KV operation
    if (typeof (kvNamespace as any).get === 'function') {
      const testKey = '__cloudflare_test__';
      await (kvNamespace as any).put(testKey, JSON.stringify({ test: true }));
      const result = await (kvNamespace as any).get(testKey, 'json');

      if (result && typeof result === 'object' && (result as any).test === true) {
        binding.status = 'bound';
        await (kvNamespace as any).delete(testKey);
      } else {
        binding.status = 'error';
        binding.error = 'KV test operation failed';
      }
    } else {
      binding.status = 'not_bound';
      binding.error = 'KV methods not available';
    }
  } catch (error) {
    binding.status = 'error';
    binding.error = String(error);
  }

  return binding;
};

export const validateD1Binding = async (
  d1Database: Record<string, unknown> | undefined
): Promise<CloudflareBinding> => {
  const binding: CloudflareBinding = {
    name: 'D1',
    type: 'd1_database',
    resource: 'goldshore (gs_db_001)',
    status: 'not_configured',
    lastChecked: new Date().toISOString(),
  };

  if (!d1Database) {
    binding.status = 'not_bound';
    binding.error = 'D1 database not available in runtime';
    return binding;
  }

  try {
    if (typeof (d1Database as any).prepare === 'function') {
      // Try a simple query
      const stmt = (d1Database as any).prepare('SELECT 1 as test');
      const result = await stmt.first();

      if (result && (result as any).test === 1) {
        binding.status = 'bound';
      } else {
        binding.status = 'error';
        binding.error = 'D1 test query failed';
      }
    } else {
      binding.status = 'not_bound';
      binding.error = 'D1 methods not available';
    }
  } catch (error) {
    binding.status = 'error';
    binding.error = String(error);
  }

  return binding;
};

export const validateR2Binding = async (
  r2Bucket: Record<string, unknown> | undefined
): Promise<CloudflareBinding> => {
  const binding: CloudflareBinding = {
    name: 'R2',
    type: 'r2_bucket',
    resource: 'gs-assets',
    status: 'not_configured',
    lastChecked: new Date().toISOString(),
  };

  if (!r2Bucket) {
    binding.status = 'not_bound';
    binding.error = 'R2 bucket not available in runtime';
    return binding;
  }

  try {
    if (typeof (r2Bucket as any).list === 'function') {
      const result = await (r2Bucket as any).list({ limit: 1 });

      if (result && typeof result === 'object') {
        binding.status = 'bound';
      } else {
        binding.status = 'error';
        binding.error = 'R2 list operation failed';
      }
    } else {
      binding.status = 'not_bound';
      binding.error = 'R2 methods not available';
    }
  } catch (error) {
    binding.status = 'error';
    binding.error = String(error);
  }

  return binding;
};

export const validateServiceBinding = async (): Promise<CloudflareBinding> => {
  const binding: CloudflareBinding = {
    name: 'API_SERVICE',
    type: 'service_binding',
    resource: 'gs-api (prod)',
    status: 'not_configured',
    lastChecked: new Date().toISOString(),
  };

  // Service bindings are checked at build time in wrangler.toml
  binding.status = 'not_configured';
  binding.error = 'Requires wrangler.toml configuration';

  return binding;
};

export const generateValidationReport = (
  bindings: CloudflareBinding[]
): CloudflareValidationResult => {
  const boundBindings = bindings.filter((b) => b.status === 'bound').length;
  const errorBindings = bindings.filter((b) => b.status === 'error').length;
  const unboundBindings = bindings.filter((b) => b.status === 'not_bound').length;

  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || 'unknown',
    projectName: 'goldshore-ai',
    bindings,
    summary: {
      totalBindings: bindings.length,
      boundBindings,
      errorBindings,
      unboundBindings,
    },
    lastSync: new Date().toISOString(),
  };
};

export const getBindingStatusColor = (status: string): string => {
  const statusMap = {
    bound: 'gs-status--ok',
    not_bound: 'gs-status--warn',
    error: 'gs-status--err',
    not_configured: 'gs-status--info',
  };
  return statusMap[status as keyof typeof statusMap] || 'gs-status--info';
};
