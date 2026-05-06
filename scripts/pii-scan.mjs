import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const getArgValue = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
};

const mode = getArgValue('--mode', 'local');
const outputPath = getArgValue('--output', 'apps/gs-admin/src/data/pii-scan-results.json');
const summaryPath = getArgValue('--summary', 'reports/pii-scan-summary.md');
const maxFindings = Number(getArgValue('--max-findings', '250'));

const skipExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
  '.gz',
  '.tar',
  '.tgz',
  '.mp4',
  '.mov',
  '.mp3',
  '.wav',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.lock'
]);

const webRoots = [
  'apps/gs-web',
  'apps/gs-admin',
  'public',
  'docs'
];

const piiPatterns = [
  {
    id: 'email',
    label: 'Email address',
    severity: 'medium',
    regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    guidance: 'Replace with a role-based alias or redact with [redacted].'
  },
  {
    id: 'phone',
    label: 'Phone number',
    severity: 'medium',
    regex: /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    guidance: 'Swap with a masked number (e.g., +1-555-0100) or redact.'
  },
  {
    id: 'ssn',
    label: 'US SSN',
    severity: 'high',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    guidance: 'Remove SSNs from code or move to encrypted secrets storage.'
  },
  {
    id: 'credit-card',
    label: 'Credit card',
    severity: 'high',
    regex: /\b(?:\d[ -]*?){13,16}\b/g,
    guidance: 'Purge card data and use tokenized references only.'
  }
];

const alertChannels = [
  {
    channel: 'Slack #security-alerts',
    owner: 'Security Ops',
    action: 'Create incident ticket and triage within 4 hours.'
  },
  {
    channel: 'Email ops@goldshore.ai',
    owner: 'Platform Ops',
    action: 'Notify service owners and confirm remediation owners.'
  }
];

const getRepoFiles = () => {
  if (args.has('--staged')) {
    return execSync('git diff --name-only --cached', { encoding: 'utf8' })
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean);
  }
  return execSync('git ls-files', { encoding: 'utf8' })
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
};

const isTextFile = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (skipExtensions.has(ext)) return false;
  return true;
};

const isWebContent = (filePath) =>
  webRoots.some((root) => filePath.startsWith(root + path.sep) || filePath === root);

const findMatches = (content, filePath) => {
  const findings = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    piiPatterns.forEach((pattern) => {
      const matches = line.match(pattern.regex);
      if (!matches) return;
      matches.forEach((match) => {
        findings.push({
          type: pattern.label,
          severity: pattern.severity,
          location: `${filePath}:${index + 1}`,
          snippet: match.length > 120 ? `${match.slice(0, 117)}...` : match,
          guidance: pattern.guidance
        });
      });
    });
  });

  return findings;
};

const buildSummary = (findings) => {
  const counts = { low: 0, medium: 0, high: 0 };
  findings.forEach((finding) => {
    counts[finding.severity] += 1;
  });
  const total = findings.length;
  const status = counts.high > 0 ? 'Critical' : counts.medium > 0 ? 'Warning' : 'Clear';
  return { total, status, ...counts };
};

const collectRemediation = (findings) => {
  const guidance = new Set([
    'Remove or redact PII from source files and static assets.',
    'Replace hard-coded PII with synthetic test data.',
    'Store sensitive data in approved secret managers or vaults.'
  ]);
  findings.forEach((finding) => guidance.add(finding.guidance));
  return Array.from(guidance);
};

const main = async () => {
  const files = getRepoFiles();
  const codeFindings = [];
  const webFindings = [];
  let scannedCode = 0;
  let scannedWeb = 0;

  for (const file of files) {
    if (!isTextFile(file)) continue;
    const filePath = path.resolve(file);
    let content = '';
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > 1024 * 512) continue;
      content = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    const matches = findMatches(content, file);
    const targetArray = isWebContent(file) ? webFindings : codeFindings;
    if (isWebContent(file)) {
      scannedWeb += 1;
    } else {
      scannedCode += 1;
    }
    matches.forEach((match) => {
      if (codeFindings.length + webFindings.length >= maxFindings) return;
      targetArray.push({ id: `PII-${String(codeFindings.length + webFindings.length + 1).padStart(3, '0')}`, ...match });
    });
  }

  const findings = [...codeFindings, ...webFindings];
  const summary = buildSummary(findings);
  const remediation = collectRemediation(findings);
  const alertStatus = summary.high > 0 ? 'Immediate' : summary.total > 0 ? 'Monitor' : 'Clear';
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalFindings: summary.total,
      status: summary.status,
      high: summary.high,
      medium: summary.medium,
      low: summary.low
    },
    sources: [
      { name: 'Repository code', scanType: 'code', scannedFiles: scannedCode, findings: codeFindings.length },
      { name: 'Web content', scanType: 'web', scannedFiles: scannedWeb, findings: webFindings.length }
    ],
    findings,
    remediation,
    alerts: {
      status: alertStatus,
      channels: alertChannels
    }
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2));

  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  const summaryLines = [
    `# PII Scan Summary`,
    ``,
    `**Status:** ${summary.status}`,
    `**Alert Status:** ${alertStatus}`,
    ``,
    `- Total findings: ${summary.total}`,
    `- High severity: ${summary.high}`,
    `- Medium severity: ${summary.medium}`,
    `- Low severity: ${summary.low}`,
    ``,
    `## Alert Routing`,
    ...alertChannels.map(
      (channel) => `- ${channel.channel} (${channel.owner}): ${channel.action}`
    ),
    ``,
    `## Remediation Guidance`,
    ...remediation.map((item) => `- ${item}`)
  ];
  await fs.writeFile(summaryPath, summaryLines.join('\n'));

  if (mode === 'ci' && summary.total > 0) {
    console.log(`::warning::PII scan found ${summary.total} potential matches (${summary.high} high severity).`);
  }
  if (mode === 'ci' && summary.high > 0) {
    console.log('::warning::High severity PII detected. Immediate remediation recommended.');
  }

  if (mode === 'pre-commit' && summary.total > 0) {
    console.log(`PII scan warning: ${summary.total} potential matches found (${summary.high} high severity).`);
    console.log('Review findings and follow remediation guidance before commit.');
  }

  if (args.has('--print')) {
    console.log(JSON.stringify(report, null, 2));
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
