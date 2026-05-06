export const offerings = [
  {
    title: 'Applied Intelligence',
    summary: 'Decision support systems tuned for high-stakes operations.',
    metric: 'Reduced operator triage time by 34% in pilot environments.',
  },
  {
    title: 'Observability Engineering',
    summary: 'Unified tracing, logging, and event health diagnostics.',
    metric: 'Alert precision improved to 92% after telemetry redesign.',
  },
  {
    title: 'Resilience Architecture',
    summary: 'Failure-aware platform design for mission-critical runtimes.',
    metric: 'Recovery workflows validated under 15-minute RTO constraints.',
  },
];

export const services = [
  {
    name: 'Operational AI Infrastructure',
    objective:
      'Build reliable AI-backed runtime systems with clear ownership and operational controls.',
    deliverables: [
      'Reference architecture',
      'Runbook baseline',
      'Runtime governance matrix',
    ],
    timeframe: '4–8 weeks',
  },
  {
    name: 'Telemetry and Observability Modernisation',
    objective:
      'Unify fragmented signals into an actionable observability layer for distributed systems.',
    deliverables: [
      'Telemetry schema',
      'SLO dashboard set',
      'Escalation playbooks',
    ],
    timeframe: '3–6 weeks',
  },
  {
    name: 'Risk and Recovery Readiness',
    objective:
      'Model risk vectors and formalise response patterns before incidents become outages.',
    deliverables: [
      'Risk map',
      'Scenario simulations',
      'Recovery protocol review',
    ],
    timeframe: '2–5 weeks',
  },
];

export const caseStudies = [
  {
    service: 'Operational AI Infrastructure',
    outcome:
      'Stabilised deployment flow for a compliance-heavy analytics stack.',
    result: '41% faster release confidence cycle.',
    technology: 'ArgoCD + OpenTelemetry',
  },
  {
    service: 'Telemetry and Observability Modernisation',
    outcome: 'Consolidated alerting into a role-oriented operational cockpit.',
    result: 'Mean time to isolate incidents dropped from 48 to 19 minutes.',
    technology: 'Grafana + Prometheus',
  },
  {
    service: 'Risk and Recovery Readiness',
    outcome:
      'Introduced dependency-aware recovery protocol for core workloads.',
    result: 'Quarterly failover tests reached 100% completion.',
    technology: 'Kubernetes + Chaos Mesh',
  },
];

export const team = [
  {
    name: 'Ari Morgan',
    role: 'Principal Infrastructure Lead',
    bio: 'Ari specialises in distributed AI infrastructure for regulated and latency-sensitive operations. They lead architecture decisions, frame system trade-offs, and translate platform constraints into execution-ready delivery plans for technical stakeholders.',
  },
  {
    name: 'Nadia Chen',
    role: 'Observability and Reliability Engineer',
    bio: 'Nadia designs instrumentation and service-level diagnostics for high-pressure runtime environments. She owns telemetry strategy, incident signal quality, and reliability guardrails that help teams respond with confidence during operational volatility.',
  },
  {
    name: 'Theo Reyes',
    role: 'Applied Intelligence Strategist',
    bio: 'Theo guides practical adoption of AI in production systems. He maps use cases to measurable operational outcomes and ensures model-enabled workflows integrate cleanly with existing controls, security boundaries, and incident procedures.',
  },
];

export const credibility = {
  domains: [
    'AI infrastructure',
    'Observability',
    'System resilience',
    'Operational governance',
  ],
  signals: [
    '15+ years in mission-critical systems',
    'Cross-sector deployments in finance and industrial operations',
    'Runbooks and controls aligned to reliability-first delivery',
  ],
};
