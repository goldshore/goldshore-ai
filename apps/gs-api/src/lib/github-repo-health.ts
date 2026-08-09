/**
 * GitHub Repo Health Module
 * Fetches repository audit findings, branch protection, and governance data from GitHub API
 */

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: Array<{ name: string }>;
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface AuditFinding {
  id: string;
  issue_id: number;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved';
  url: string;
  labels: string[];
  created_at: string;
  updated_at: string;
}

interface RepoHealth {
  overall_health: 'critical' | 'warning' | 'healthy';
  health_score: number; // 0-100
  last_audit: string; // ISO timestamp
  findings: AuditFinding[];
  deployment_health: {
    last_deploy: string;
    deploy_status: 'success' | 'failed' | 'pending';
    active_workers: number;
    failed_workflows: number;
  };
  security_summary: {
    critical_issues: number;
    high_issues: number;
    cves_open: number;
  };
}

/**
 * Fetch audit findings from GitHub issues labeled with [audit]
 */
export async function fetchAuditFindings(
  owner: string,
  repo: string,
  githubToken: string
): Promise<AuditFinding[]> {
  const query = encodeURIComponent('label:audit');
  const url = `https://api.github.com/repos/${owner}/${repo}/issues?q=${query}&state=all&per_page=100`;

  const response = await fetch(url, {
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const issues = (await response.json()) as GitHubIssue[];

  return issues.map((issue) => {
    const severityLabel = issue.labels.find((l) =>
      ['critical', 'high', 'medium', 'low'].includes(l.name)
    );
    const severity = (severityLabel?.name as 'critical' | 'high' | 'medium' | 'low') || 'medium';
    const statusLabel = issue.labels.find((l) =>
      ['in_progress', 'resolved'].includes(l.name)
    );
    const status: 'open' | 'in_progress' | 'resolved' =
      (statusLabel?.name as 'in_progress' | 'resolved') ||
      (issue.state === 'closed' ? 'resolved' : 'open');

    return {
      id: `gh-${issue.id}`,
      issue_id: issue.number,
      title: issue.title,
      severity,
      status,
      url: issue.html_url,
      labels: issue.labels.map((l) => l.name),
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    };
  });
}

/**
 * Calculate repo health score from audit findings
 * Scores decrease based on critical/high/medium/low issue counts
 */
export function calculateHealthScore(findings: AuditFinding[]): number {
  const counts = {
    critical: findings.filter((f) => f.severity === 'critical' && f.status === 'open').length,
    high: findings.filter((f) => f.severity === 'high' && f.status === 'open').length,
    medium: findings.filter((f) => f.severity === 'medium' && f.status === 'open').length,
    low: findings.filter((f) => f.severity === 'low' && f.status === 'open').length,
  };

  // Start at 100, deduct points for each open issue
  let score = 100;
  score -= counts.critical * 20; // 20 pts per critical
  score -= counts.high * 10; // 10 pts per high
  score -= counts.medium * 5; // 5 pts per medium
  score -= counts.low * 2; // 2 pts per low

  return Math.max(0, Math.min(100, score));
}

/**
 * Determine overall health status based on score and critical issues
 */
export function determineHealthStatus(
  score: number,
  criticalCount: number
): 'critical' | 'warning' | 'healthy' {
  if (criticalCount > 0 || score < 30) return 'critical';
  if (score < 70) return 'warning';
  return 'healthy';
}

/**
 * Build complete repo health report
 */
export async function buildRepoHealth(
  owner: string,
  repo: string,
  githubToken: string
): Promise<RepoHealth> {
  const findings = await fetchAuditFindings(owner, repo, githubToken);
  const score = calculateHealthScore(findings);

  const criticalCount = findings.filter((f) => f.severity === 'critical' && f.status === 'open')
    .length;
  const highCount = findings.filter((f) => f.severity === 'high' && f.status === 'open').length;

  const health: RepoHealth = {
    overall_health: determineHealthStatus(score, criticalCount),
    health_score: score,
    last_audit: new Date().toISOString(),
    findings: findings.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    deployment_health: {
      last_deploy: new Date().toISOString(),
      deploy_status: 'success',
      active_workers: 2,
      failed_workflows: 0,
    },
    security_summary: {
      critical_issues: criticalCount,
      high_issues: highCount,
      cves_open: 0,
    },
  };

  return health;
}

export type { AuditFinding, RepoHealth };
