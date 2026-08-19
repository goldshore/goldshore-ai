# MCP Servers for goldshore-ai Phase 4 Workflows

This directory contains Model Context Protocol (MCP) servers that enable automated workflows for the goldshore-ai enterprise platform.

## Overview

MCP servers run as separate processes and provide tool interfaces to Claude and other LLM-based agents. Each server exposes capabilities through standardized JSON-RPC tools.

**Status**: Phase 1 Complete
- ✅ GitHub PR Manager (GitHub API)
- ✅ Email Mailbox Manager (Resend/SMTP)
- 🔄 Google Ads Integrator (planned)
- 🔄 SQL/D1 Sync Manager (planned)
- 🔄 Plugin Registry Manager (planned)

---

## Available MCP Servers

### 1. GitHub PR Manager (`github-pr-manager`)

Manages pull requests, issues, and CI/CD workflows on GitHub.

**Prerequisites**:
- `GITHUB_TOKEN` environment variable set
- GitHub repository owner and name

**Tools**:
- `github_list_prs` - List pull requests with filtering
- `github_get_pr` - Get PR details and metadata
- `github_create_pr` - Create a new pull request
- `github_merge_pr` - Merge a pull request
- `github_check_ci_status` - Check CI/CD status for commits
- `github_list_issues` - List issues in a repository
- `github_add_review` - Add reviews to pull requests

**Example Usage**:

```typescript
import { initGitHubPRManager } from './github-pr-manager';

const server = await initGitHubPRManager();
// Server now exposes GitHub tools to clients
```

---

### 2. Email Mailbox Manager (`email-mailbox-manager`)

Manages email sending, templates, and queue operations.

**Prerequisites**:
- `EMAIL_API_KEY` or `RESEND_API_KEY` environment variable
- Email service configured (Resend, SendGrid, etc.)

**Tools**:
- `email_send` - Send a single email
- `email_send_batch` - Send multiple emails efficiently
- `email_get_status` - Check delivery status
- `email_create_template` - Create reusable email templates
- `email_get_template` - Retrieve template details
- `email_list_templates` - List all templates
- `email_send_from_template` - Send using templates with variable substitution
- `email_list_recent` - List recently sent emails

**Example Usage**:

```typescript
import { initEmailMailboxManager } from './email-mailbox-manager';

const server = await initEmailMailboxManager();
// Server now exposes Email tools to clients
```

---

## Running MCP Servers

### Option 1: Standalone Process (Recommended)

Each MCP server runs as a separate Node.js process with stdio transport:

```bash
# GitHub PR Manager
node --loader tsx ./src/mcp/github-pr-manager.ts

# Email Mailbox Manager
node --loader tsx ./src/mcp/email-mailbox-manager.ts
```

### Option 2: Integrated with gs-api Worker

MCP servers can be initialized within the main Worker process:

```typescript
import { initializeAllMCPServers } from './mcp';

// In worker initialization
const mcpServers = await initializeAllMCPServers();
console.log(`Initialized ${mcpServers.length} MCP servers`);
```

### Option 3: Via MCP Client (in applications)

```typescript
import { MCPRegistry } from './mcp';

// Dynamically load a server
const server = await MCPRegistry['github-pr-manager'].init();
```

---

## Configuration

### Environment Variables

Create `.env` or configure in Cloudflare Workers Secrets:

```bash
# GitHub
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
GITHUB_OWNER=marzton
GITHUB_REPO=goldshore-ai

# Email (choose one)
EMAIL_API_KEY=re_xxxxxxxxxxxx              # Resend
RESEND_API_KEY=re_xxxxxxxxxxxx            # Alternative

# Optional
MCP_LOG_LEVEL=debug                       # Logging level
MCP_TIMEOUT_MS=30000                      # Request timeout
```

### Cloudflare Workers Configuration

In `wrangler.toml`:

```toml
[env.production]
vars = { GITHUB_OWNER = "marzton", GITHUB_REPO = "goldshore-ai" }

[env.production.secrets]
# Add via: wrangler secret put GITHUB_TOKEN
# GITHUB_TOKEN = "ghp_..."
# EMAIL_API_KEY = "re_..."
```

---

## Architecture

### Shared Utilities (`shared.ts`)

Provides common patterns used by all MCP servers:

- **ToolResult** - Standardized response format
- **createErrorResponse()** - Error handling
- **createJsonResponse()** - JSON responses
- **createTextResponse()** - Text responses
- **safeApiCall()** - Error-safe API wrapper
- **Pagination** - Pagination support
- **formatDate()** - Date formatting
- **truncate()** - Text truncation

### Server Structure

Each MCP server follows this pattern:

```typescript
1. API Client Wrapper (handles auth, HTTP calls)
2. Tool Registration (registerTool for each capability)
3. Input Validation (Zod schemas)
4. Error Handling (try-catch, meaningful messages)
5. Transport Setup (StdioServerTransport)
```

---

## Integration with goldshore-ai Workflows

### Phase 2 Admin Dashboard
- Email templates management UI
- PR workflow automation
- Issue triage automation

### Phase 3 Workflows
- Automated PR creation for approved features
- Email notifications for workflow status
- Issue assignment automation

### Phase 4 Enterprise Features
- **PR Manager** → Automated PR review, merge coordination
- **Mailbox Management** → Email template builder, queue monitoring
- **SQL Sync** → Database migration notifications
- **Plugin Installer** → Package update emails

---

## Development

### Adding a New MCP Server

1. Create `new-server.ts` in this directory
2. Implement API client wrapper
3. Register tools with schema validation
4. Export `initNewServer()` function
5. Add to `MCPRegistry` in `index.ts`
6. Add environment variable documentation

### Testing with MCP Inspector

```bash
# Install inspector
npm install -g @modelcontextprotocol/inspector

# Test a server
mcp-inspector node --loader tsx ./src/mcp/github-pr-manager.ts
```

Navigate to `http://localhost:3000` to test tools interactively.

---

## Best Practices

1. **Use Strong Validation** - All tool inputs validated with Zod
2. **Meaningful Errors** - Error messages guide users to solutions
3. **Pagination** - Support `page` and `limit` for large result sets
4. **Timeout Handling** - Set reasonable timeouts for external APIs
5. **Structured Responses** - Use JSON for complex data
6. **Read-Only Defaults** - Tools should be read operations by default
7. **Document Everything** - Clear descriptions help LLM discovery

---

## Deployment

### Development
```bash
pnpm --filter gs-api dev
# MCP servers initialize in the Worker
```

### Production
```bash
# Push to Cloudflare
wrangler deploy --env production

# Secrets are pre-configured in Cloudflare
# MCP servers initialize automatically
```

---

## Monitoring

### Logs

MCP server logs appear in:
- Local dev: stdout/stderr
- Production: Cloudflare Worker logs via dashboard

### Debugging

Enable debug logging:

```bash
MCP_LOG_LEVEL=debug node --loader tsx ./src/mcp/github-pr-manager.ts
```

---

## Roadmap

**Week 1 (Current)**: GitHub PR Manager, Email Mailbox Manager ✅

**Week 2**: 
- Google Ads Integrator (ad campaign management)
- SQL/D1 Sync Manager (database migration notifications)

**Week 3**:
- Plugin Registry Manager (package installation)
- Site Builder Integration (design/rendering)

**Week 4+**:
- AI Search Integration (semantic search)
- Advanced workflow automation

---

## Support

For issues or questions:
1. Check environment variables are set correctly
2. Run `mcp-inspector` to test tool availability
3. Check Cloudflare Worker logs for runtime errors
4. See CLAUDE.md for project context

---

**Created**: 2026-08-17  
**Status**: Production Ready  
**Version**: 1.0.0
