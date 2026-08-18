/**
 * MCP Configuration for goldshore-ai
 * Defines server instances, transport, and settings
 */

export interface MCPServerConfig {
  name: string;
  enabled: boolean;
  transport: 'stdio' | 'http';
  port?: number;
  timeout?: number;
  requiredEnvVars: string[];
  description: string;
}

export interface MCPTransportConfig {
  type: 'stdio' | 'http';
  stdio?: {
    command: string;
    args?: string[];
  };
  http?: {
    url: string;
    headers?: Record<string, string>;
  };
}

/**
 * MCP Server Configurations
 * Define how each MCP server should be initialized and run
 */
export const MCP_SERVERS: Record<string, MCPServerConfig> = {
  'github-pr-manager': {
    name: 'github-pr-manager',
    enabled: !!process.env.GITHUB_TOKEN,
    transport: 'stdio',
    timeout: 30000,
    requiredEnvVars: ['GITHUB_TOKEN'],
    description: 'GitHub PR and issue management',
  },
  'email-mailbox-manager': {
    name: 'email-mailbox-manager',
    enabled: !!process.env.EMAIL_API_KEY || !!process.env.RESEND_API_KEY,
    transport: 'stdio',
    timeout: 15000,
    requiredEnvVars: ['EMAIL_API_KEY', 'RESEND_API_KEY'],
    description: 'Email sending and template management',
  },
};

/**
 * Get enabled servers
 */
export function getEnabledServers(): MCPServerConfig[] {
  return Object.values(MCP_SERVERS).filter((config) => config.enabled);
}

/**
 * Check if a server is properly configured
 */
export function isServerConfigured(serverName: string): boolean {
  const config = MCP_SERVERS[serverName];
  if (!config) return false;

  return config.requiredEnvVars.some(
    (envVar) => process.env[envVar] !== undefined && process.env[envVar] !== ''
  );
}

/**
 * Get server configuration
 */
export function getServerConfig(serverName: string): MCPServerConfig | undefined {
  return MCP_SERVERS[serverName];
}

/**
 * MCP Client Configuration for connecting to servers
 * Used by Claude and agents to interact with MCP servers
 */
export const MCP_CLIENT_CONFIG = {
  servers: {
    'github-pr-manager': {
      command: 'node',
      args: ['--loader', 'tsx', 'src/mcp/github-pr-manager.ts'],
      env: {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
      },
    },
    'email-mailbox-manager': {
      command: 'node',
      args: ['--loader', 'tsx', 'src/mcp/email-mailbox-manager.ts'],
      env: {
        EMAIL_API_KEY: process.env.EMAIL_API_KEY || '',
        RESEND_API_KEY: process.env.RESEND_API_KEY || '',
      },
    },
  },
};

/**
 * Logging configuration
 */
export const MCP_LOG_CONFIG = {
  level: (process.env.MCP_LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
  pretty: process.env.NODE_ENV !== 'production',
};

/**
 * Initialize logging
 */
export function initMCPLogging() {
  const level = MCP_LOG_CONFIG.level;
  const pretty = MCP_LOG_CONFIG.pretty;

  console.log(`[MCP] Logging initialized (level: ${level}, pretty: ${pretty})`);

  if (!process.env.GITHUB_TOKEN) {
    console.warn('[MCP] GITHUB_TOKEN not set - GitHub PR Manager disabled');
  }

  if (!process.env.EMAIL_API_KEY && !process.env.RESEND_API_KEY) {
    console.warn('[MCP] EMAIL_API_KEY/RESEND_API_KEY not set - Email Manager disabled');
  }
}

/**
 * Diagnostic summary
 */
export function getMCPDiagnostics() {
  const enabled = getEnabledServers();
  const disabled = Object.values(MCP_SERVERS).filter((config) => !config.enabled);

  return {
    enabled: enabled.map((s) => ({
      name: s.name,
      description: s.description,
      transport: s.transport,
    })),
    disabled: disabled.map((s) => ({
      name: s.name,
      description: s.description,
      missingEnv: s.requiredEnvVars.filter((env) => !process.env[env]),
    })),
    summary: `${enabled.length} MCP servers enabled, ${disabled.length} disabled`,
  };
}

/**
 * Export diagnostics
 */
if (require.main === module) {
  initMCPLogging();
  console.log('\n[MCP] Diagnostics:\n', JSON.stringify(getMCPDiagnostics(), null, 2));
}
