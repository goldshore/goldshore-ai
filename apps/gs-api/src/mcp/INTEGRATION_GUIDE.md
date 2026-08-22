# MCP Integration Guide for goldshore-ai Phase 4 Workflows

This guide shows how to integrate MCP servers into goldshore-ai admin workflows and automation systems.

## Quick Start

### 1. Initialize MCP Servers in Worker

In `apps/gs-api/src/index.ts`, import and initialize MCP servers:

```typescript
import { initializeAllMCPServers } from './mcp';

export default {
  async fetch(request: Request, env: Env) {
    // Initialize MCP servers (runs once)
    if (!globalThis.mcpInitialized) {
      const servers = await initializeAllMCPServers();
      console.log(`Initialized ${servers.length} MCP servers`);
      globalThis.mcpInitialized = true;
    }

    // ... rest of Worker logic
  },
};
```

### 2. Use MCP Tools in Admin API Routes

Create admin API routes that leverage MCP server tools:

```typescript
// apps/gs-api/src/routes/admin/workflows.ts
import { Hono } from 'hono';
import { MCPRegistry } from '../../mcp';

const app = new Hono();

// Trigger automated PR review workflow
app.post('/workflows/pr-review', async (c) => {
  const { owner, repo, prNumber } = await c.req.json();

  const githubServer = await MCPRegistry['github-pr-manager'].init();
  
  // Get PR details
  const prDetails = githubServer.call('github_get_pr', {
    owner,
    repo,
    pr_number: prNumber,
  });

  // Check CI status
  const ciStatus = githubServer.call('github_check_ci_status', {
    owner,
    repo,
    ref: 'main', // or dynamic from PR
  });

  // Auto-approve if CI passes
  const results = await Promise.all([prDetails, ciStatus]);
  
  return c.json({
    workflow: 'pr-review',
    status: 'success',
    details: results,
  });
});

// Trigger email campaign workflow
app.post('/workflows/email-campaign', async (c) => {
  const { templateId, recipients, variables } = await c.req.json();

  const emailServer = await MCPRegistry['email-mailbox-manager'].init();
  
  // Send batch emails from template
  const sendResults = await Promise.all(
    recipients.map((email) =>
      emailServer.call('email_send_from_template', {
        template_id: templateId,
        to: email,
        from: 'noreply@goldshore.ai',
        variables,
      })
    )
  );

  return c.json({
    workflow: 'email-campaign',
    sent: sendResults.length,
    recipients: recipients.length,
  });
});

export default app;
```

---

## Phase 4 Workflow Examples

### Workflow 1: Automated PR Management

**Goal**: Automatically review, test, and merge PRs based on CI status

```typescript
async function automatedPRWorkflow(owner: string, repo: string, prNumber: number) {
  const githubServer = await MCPRegistry['github-pr-manager'].init();

  // 1. Get PR details
  const pr = await githubServer.call('github_get_pr', {
    owner,
    repo,
    pr_number: prNumber,
  });

  // 2. Check CI status
  const ciStatus = await githubServer.call('github_check_ci_status', {
    owner,
    repo,
    ref: pr.head.sha,
  });

  // 3. If CI passes, add approval review
  if (ciStatus.every((check) => check.conclusion === 'success')) {
    await githubServer.call('github_add_review', {
      owner,
      repo,
      pr_number: prNumber,
      body: '✅ CI passed. Approved by automation.',
      event: 'APPROVE',
    });

    // 4. Auto-merge
    await githubServer.call('github_merge_pr', {
      owner,
      repo,
      pr_number: prNumber,
      method: 'squash',
    });

    return { status: 'merged', method: 'squash' };
  }

  return { status: 'pending', reason: 'CI not all green' };
}
```

### Workflow 2: Email Template Management & Campaigns

**Goal**: Create templates and run bulk email campaigns

```typescript
async function emailCampaignWorkflow(campaignData: {
  name: string;
  subject: string;
  htmlTemplate: string;
  recipients: string[];
  variables?: Record<string, string>;
}) {
  const emailServer = await MCPRegistry['email-mailbox-manager'].init();

  // 1. Create template
  const template = await emailServer.call('email_create_template', {
    name: campaignData.name,
    subject: campaignData.subject,
    html: campaignData.htmlTemplate,
  });

  console.log(`✓ Template created: ${template.template_id}`);

  // 2. Send batch emails
  const sendResults = await Promise.all(
    campaignData.recipients.map((email) =>
      emailServer.call('email_send_from_template', {
        template_id: template.template_id,
        to: email,
        from: 'marketing@goldshore.ai',
        variables: campaignData.variables || {},
      })
    )
  );

  // 3. Track delivery
  const statuses = await Promise.all(
    sendResults.map((result) =>
      emailServer.call('email_get_status', {
        email_id: result.email_id,
      })
    )
  );

  return {
    campaign: campaignData.name,
    templates_created: 1,
    emails_sent: sendResults.length,
    delivery_status: statuses,
  };
}
```

### Workflow 3: Issue Triage & Assignment

**Goal**: Automatically label, categorize, and assign GitHub issues

```typescript
async function issuTriageWorkflow(owner: string, repo: string) {
  const githubServer = await MCPRegistry['github-pr-manager'].init();

  // 1. List open issues
  const issues = await githubServer.call('github_list_issues', {
    owner,
    repo,
    state: 'open',
    page: 1,
    limit: 50,
  });

  // 2. Triage each issue
  const triageResults = issues.map((issue) => {
    const title = issue.title.toLowerCase();
    let labels = [];
    let assignee = null;

    if (title.includes('bug')) {
      labels.push('bug');
      assignee = 'team-qa';
    } else if (title.includes('feature')) {
      labels.push('enhancement');
      assignee = 'team-features';
    } else if (title.includes('docs')) {
      labels.push('documentation');
      assignee = 'team-docs';
    }

    return {
      issue_number: issue.number,
      title: issue.title,
      assigned_labels: labels,
      assigned_to: assignee,
    };
  });

  return {
    issues_processed: triageResults.length,
    triaged: triageResults,
  };
}
```

---

## Admin Dashboard Integration

### Add MCP Server Status Panel

In `apps/gs-web/src/pages/admin/mcp-status.astro`:

```astro
---
import { MCPRegistry } from '@goldshore/gs-api/mcp';
import AdminLayout from '../../layouts/AdminLayout.astro';

const diagnostics = await fetch('/api/admin/mcp/diagnostics').then(r => r.json());
---

<AdminLayout>
  <div class="mcp-status-panel">
    <h2>MCP Server Status</h2>
    
    <div class="enabled-servers">
      {diagnostics.enabled.map(server => (
        <div class="server-card">
          <span class="status-badge active">●</span>
          <span class="server-name">{server.name}</span>
          <span class="description">{server.description}</span>
        </div>
      ))}
    </div>

    <div class="disabled-servers">
      {diagnostics.disabled.map(server => (
        <div class="server-card disabled">
          <span class="status-badge inactive">●</span>
          <span class="server-name">{server.name}</span>
          <details>
            <summary>Configure</summary>
            <p>Missing: {server.missingEnv.join(', ')}</p>
          </details>
        </div>
      ))}
    </div>
  </div>
</AdminLayout>
```

### Add Workflow Trigger UI

In `apps/gs-web/src/components/admin/WorkflowTrigger.tsx`:

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface WorkflowTriggerProps {
  workflowType: 'pr-review' | 'email-campaign' | 'issue-triage';
}

export function WorkflowTrigger({ workflowType }: WorkflowTriggerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  async function triggerWorkflow() {
    setIsRunning(true);
    try {
      const response = await fetch(`/api/admin/workflows/${workflowType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Workflow-specific parameters
        }),
      });
      const data = await response.json();
      setResult(data);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="workflow-trigger">
      <Button onClick={triggerWorkflow} disabled={isRunning}>
        {isRunning ? 'Running...' : `Trigger ${workflowType}`}
      </Button>
      {result && (
        <pre className="result-panel">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}
```

---

## Environment Configuration

### Development (.env)

```bash
# GitHub
GITHUB_TOKEN=ghp_your_token_here
GITHUB_OWNER=marzton
GITHUB_REPO=goldshore-ai

# Email
RESEND_API_KEY=re_your_key_here

# MCP
MCP_LOG_LEVEL=debug
```

### Production (Cloudflare Secrets)

```bash
# Set via wrangler
wrangler secret put GITHUB_TOKEN
wrangler secret put RESEND_API_KEY
```

### wrangler.toml Configuration

```toml
[env.production]
vars = { 
  GITHUB_OWNER = "marzton",
  GITHUB_REPO = "goldshore-ai",
  MCP_LOG_LEVEL = "info"
}

# Secrets are set via wrangler secret put
# [env.production.secrets] cannot be committed
```

---

## API Routes for MCP

### Admin API Endpoints

**GET** `/api/admin/mcp/status`
- Returns MCP server health and status

**POST** `/api/admin/mcp/tools`
- Execute any MCP tool with parameters
- Body: `{ server: string, tool: string, params: object }`

**POST** `/api/admin/workflows/{workflowType}`
- Trigger specific workflows
- Supported: `pr-review`, `email-campaign`, `issue-triage`

**GET** `/api/admin/mcp/servers`
- List available MCP servers and their tools

---

## Testing & Validation

### Test MCP Servers with Inspector

```bash
# Terminal 1: Start GitHub PR Manager
node --loader tsx apps/gs-api/src/mcp/github-pr-manager.ts

# Terminal 2: Start MCP Inspector
npx @modelcontextprotocol/inspector node --loader tsx \
  apps/gs-api/src/mcp/github-pr-manager.ts

# Open http://localhost:3000 in browser
```

### Unit Testing

```typescript
// apps/gs-api/src/mcp/github-pr-manager.test.ts
import { describe, it, expect } from 'node:test';
import { initGitHubPRManager } from './github-pr-manager';

describe('GitHub PR Manager', () => {
  it('initializes server without errors', async () => {
    const server = await initGitHubPRManager();
    expect(server).toBeDefined();
  });

  it('registers all required tools', async () => {
    const server = await initGitHubPRManager();
    const tools = server._tools;
    expect(tools.has('github_list_prs')).toBe(true);
    expect(tools.has('github_create_pr')).toBe(true);
  });
});
```

---

## Troubleshooting

### "MCP Server Failed to Initialize"

1. Check environment variables are set
2. Verify API credentials are valid
3. Check network connectivity to external APIs
4. Review Cloudflare Worker logs

### "Tool Not Found"

1. Verify MCP server is enabled (check diagnostics)
2. Confirm tool name is correct
3. Check MCP server version supports the tool

### "API Rate Limit Exceeded"

1. Implement exponential backoff in retries
2. Cache results when possible
3. Use batch operations (email_send_batch, etc.)

---

## Next Steps (Phases 2-4)

**Week 2**: SQL Sync, Google Ads Integrator
**Week 3**: Plugin Registry, Site Builder
**Week 4+**: AI Search, Advanced automation

---

**Version**: 1.0.0  
**Last Updated**: 2026-08-17  
**Status**: Ready for Phase 2
