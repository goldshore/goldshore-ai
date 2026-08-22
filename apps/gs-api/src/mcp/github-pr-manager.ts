/**
 * MCP Server for GitHub PR Management
 * Enables workflows for PR creation, review, CI monitoring, and issue management
 */

import { McpServer, StdioServerTransport } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  createErrorResponse,
  createTextResponse,
  createJsonResponse,
  PaginationSchema,
  safeApiCall,
  formatDate,
  truncate,
} from './shared';

/**
 * GitHub API client wrapper
 */
class GitHubClient {
  private token: string;
  private baseUrl = 'https://api.github.com';

  constructor(token: string) {
    this.token = token;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown
  ): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `token ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getPullRequest(owner: string, repo: string, prNumber: number) {
    return this.request('GET', `/repos/${owner}/${repo}/pulls/${prNumber}`);
  }

  async listPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all',
    page: number,
    limit: number
  ) {
    return this.request(
      'GET',
      `/repos/${owner}/${repo}/pulls?state=${state}&page=${page}&per_page=${limit}`
    );
  }

  async createPullRequest(
    owner: string,
    repo: string,
    data: {
      title: string;
      head: string;
      base: string;
      body?: string;
      draft?: boolean;
    }
  ) {
    return this.request('POST', `/repos/${owner}/${repo}/pulls`, data);
  }

  async updatePullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    data: {
      state?: 'open' | 'closed';
      title?: string;
      body?: string;
      draft?: boolean;
    }
  ) {
    return this.request('PATCH', `/repos/${owner}/${repo}/pulls/${prNumber}`, data);
  }

  async mergePullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    data?: {
      commit_title?: string;
      commit_message?: string;
      merge_method?: 'merge' | 'squash' | 'rebase';
    }
  ) {
    return this.request('PUT', `/repos/${owner}/${repo}/pulls/${prNumber}/merge`, data);
  }

  async addPullRequestReview(
    owner: string,
    repo: string,
    prNumber: number,
    data: {
      body: string;
      event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    }
  ) {
    return this.request('POST', `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, data);
  }

  async getCheckRuns(owner: string, repo: string, ref: string) {
    return this.request('GET', `/repos/${owner}/${repo}/commits/${ref}/check-runs`);
  }

  async listIssues(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all',
    page: number,
    limit: number
  ) {
    return this.request(
      'GET',
      `/repos/${owner}/${repo}/issues?state=${state}&page=${page}&per_page=${limit}`
    );
  }

  async createIssue(
    owner: string,
    repo: string,
    data: {
      title: string;
      body?: string;
      labels?: string[];
      assignees?: string[];
    }
  ) {
    return this.request('POST', `/repos/${owner}/${repo}/issues`, data);
  }
}

/**
 * Initialize GitHub PR Manager MCP Server
 */
export async function initGitHubPRManager() {
  const githubToken = process.env.GITHUB_TOKEN || '';
  if (!githubToken) {
    console.warn('GITHUB_TOKEN not set - GitHub PR Manager will not function');
  }

  const client = new GitHubClient(githubToken);
  const server = new McpServer({
    name: 'github-pr-manager',
    version: '1.0.0',
  });

  // List Pull Requests
  server.registerTool(
    'github_list_prs',
    {
      description: 'List pull requests in a GitHub repository',
      inputSchema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        state: z.enum(['open', 'closed', 'all']).default('open'),
        ...PaginationSchema.shape,
      }),
    },
    async (params) => {
      const result = await safeApiCall(
        () =>
          client.listPullRequests(
            params.owner,
            params.repo,
            params.state,
            params.page,
            params.limit
          ),
        'list_prs'
      );

      if (!result) {
        return createErrorResponse('Failed to fetch pull requests');
      }

      const prs = Array.isArray(result)
        ? result.map((pr: any) => ({
            number: pr.number,
            title: pr.title,
            state: pr.state,
            author: pr.user.login,
            created_at: formatDate(pr.created_at),
            updated_at: formatDate(pr.updated_at),
            url: pr.html_url,
          }))
        : [];

      return createJsonResponse(prs);
    }
  );

  // Get Pull Request Details
  server.registerTool(
    'github_get_pr',
    {
      description: 'Get detailed information about a pull request',
      inputSchema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        pr_number: z.number().int().positive().describe('Pull request number'),
      }),
    },
    async (params) => {
      const pr = await safeApiCall(
        () => client.getPullRequest(params.owner, params.repo, params.pr_number),
        'get_pr'
      );

      if (!pr) {
        return createErrorResponse('Failed to fetch pull request');
      }

      return createJsonResponse({
        number: (pr as any).number,
        title: (pr as any).title,
        state: (pr as any).state,
        body: truncate((pr as any).body || ''),
        author: (pr as any).user.login,
        created_at: formatDate((pr as any).created_at),
        updated_at: formatDate((pr as any).updated_at),
        merged_at: (pr as any).merged_at ? formatDate((pr as any).merged_at) : null,
        commits: (pr as any).commits,
        review_comments: (pr as any).review_comments,
        url: (pr as any).html_url,
      });
    }
  );

  // Create Pull Request
  server.registerTool(
    'github_create_pr',
    {
      description: 'Create a new pull request',
      inputSchema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        title: z.string().describe('PR title'),
        head: z.string().describe('Head branch (source)'),
        base: z.string().describe('Base branch (target)'),
        body: z.string().optional().describe('PR description'),
        draft: z.boolean().optional().describe('Create as draft'),
      }),
    },
    async (params) => {
      const pr = await safeApiCall(
        () =>
          client.createPullRequest(params.owner, params.repo, {
            title: params.title,
            head: params.head,
            base: params.base,
            body: params.body,
            draft: params.draft,
          }),
        'create_pr'
      );

      if (!pr) {
        return createErrorResponse('Failed to create pull request');
      }

      return createJsonResponse({
        number: (pr as any).number,
        url: (pr as any).html_url,
        status: 'created',
      });
    }
  );

  // Merge Pull Request
  server.registerTool(
    'github_merge_pr',
    {
      description: 'Merge a pull request',
      inputSchema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        pr_number: z.number().int().positive().describe('Pull request number'),
        method: z
          .enum(['merge', 'squash', 'rebase'])
          .default('merge')
          .describe('Merge method'),
        title: z.string().optional().describe('Commit title'),
        message: z.string().optional().describe('Commit message'),
      }),
    },
    async (params) => {
      const result = await safeApiCall(
        () =>
          client.mergePullRequest(params.owner, params.repo, params.pr_number, {
            merge_method: params.method,
            commit_title: params.title,
            commit_message: params.message,
          }),
        'merge_pr'
      );

      if (!result) {
        return createErrorResponse('Failed to merge pull request');
      }

      return createTextResponse(`PR #${params.pr_number} merged successfully`);
    }
  );

  // Check CI Status
  server.registerTool(
    'github_check_ci_status',
    {
      description: 'Check CI/CD status for a commit',
      inputSchema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        ref: z.string().describe('Commit SHA or branch name'),
      }),
    },
    async (params) => {
      const checks = await safeApiCall(
        () => client.getCheckRuns(params.owner, params.repo, params.ref),
        'check_ci_status'
      );

      if (!checks) {
        return createErrorResponse('Failed to fetch CI status');
      }

      const checkRuns = (checks as any).check_runs || [];
      return createJsonResponse(
        checkRuns.map((check: any) => ({
          name: check.name,
          status: check.status,
          conclusion: check.conclusion,
          url: check.details_url,
        }))
      );
    }
  );

  // List Issues
  server.registerTool(
    'github_list_issues',
    {
      description: 'List issues in a GitHub repository',
      inputSchema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        state: z.enum(['open', 'closed', 'all']).default('open'),
        ...PaginationSchema.shape,
      }),
    },
    async (params) => {
      const issues = await safeApiCall(
        () =>
          client.listIssues(
            params.owner,
            params.repo,
            params.state,
            params.page,
            params.limit
          ),
        'list_issues'
      );

      if (!issues) {
        return createErrorResponse('Failed to fetch issues');
      }

      const issueList = Array.isArray(issues)
        ? issues.map((issue: any) => ({
            number: issue.number,
            title: issue.title,
            state: issue.state,
            author: issue.user.login,
            created_at: formatDate(issue.created_at),
            url: issue.html_url,
          }))
        : [];

      return createJsonResponse(issueList);
    }
  );

  return server;
}

/**
 * Start the MCP server
 */
export async function startGitHubPRManager() {
  const server = await initGitHubPRManager();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('GitHub PR Manager MCP server started');
}
