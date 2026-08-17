/**
 * MCP Server Registry for goldshore-ai workflows
 * Central export point for all MCP servers
 */

export { initGitHubPRManager, startGitHubPRManager } from './github-pr-manager';
export { initEmailMailboxManager, startEmailMailboxManager } from './email-mailbox-manager';
export { initCloudflareConfigSync, startCloudflareConfigSync } from './cloudflare-config-sync';
export { createErrorResponse, createTextResponse, createJsonResponse } from './shared';

/**
 * Initialize all MCP servers
 * Each server runs as a separate process with stdio transport
 */
export async function initializeAllMCPServers() {
  const servers = [];

  try {
    // GitHub PR Manager
    if (process.env.GITHUB_TOKEN) {
      console.log('Initializing GitHub PR Manager MCP server...');
      const { initGitHubPRManager } = await import('./github-pr-manager');
      const githubServer = await initGitHubPRManager();
      servers.push({ name: 'github-pr-manager', server: githubServer });
    }

    // Email Mailbox Manager
    if (process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY) {
      console.log('Initializing Email Mailbox Manager MCP server...');
      const { initEmailMailboxManager } = await import('./email-mailbox-manager');
      const emailServer = await initEmailMailboxManager();
      servers.push({ name: 'email-mailbox-manager', server: emailServer });
    }

    // Cloudflare Config Sync
    if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
      console.log('Initializing Cloudflare Config Sync MCP server...');
      const { initCloudflareConfigSync } = await import('./cloudflare-config-sync');
      const cfServer = await initCloudflareConfigSync();
      servers.push({ name: 'cloudflare-config-sync', server: cfServer });
    }

    console.log(`✓ Initialized ${servers.length} MCP servers`);
    return servers;
  } catch (error) {
    console.error('Failed to initialize MCP servers:', error);
    return [];
  }
}

/**
 * MCP Server Registry
 * Maps MCP server names to their initialization functions
 */
export const MCPRegistry = {
  'github-pr-manager': {
    description: 'GitHub PR management for pull requests, issues, and CI/CD',
    requiredEnv: ['GITHUB_TOKEN'],
    init: async () => {
      const { initGitHubPRManager } = await import('./github-pr-manager');
      return initGitHubPRManager();
    },
  },
  'email-mailbox-manager': {
    description: 'Email management for sending, templating, and queue management',
    requiredEnv: ['EMAIL_API_KEY', 'RESEND_API_KEY'],
    init: async () => {
      const { initEmailMailboxManager } = await import('./email-mailbox-manager');
      return initEmailMailboxManager();
    },
  },
  'cloudflare-config-sync': {
    description: 'Cloudflare Worker configuration synchronization across environments',
    requiredEnv: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
    init: async () => {
      const { initCloudflareConfigSync } = await import('./cloudflare-config-sync');
      return initCloudflareConfigSync();
    },
  },
} as const;

export type MCPServerName = keyof typeof MCPRegistry;
