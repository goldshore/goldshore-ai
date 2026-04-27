export type ComponentStatus =
  | 'operational'
  | 'degraded'
  | 'outage'
  | 'maintenance';

export type StatusComponent = {
  id: string;
  name: string;
  status: ComponentStatus;
  detail: string;
};

export type StatusSource = {
  mode: 'local';
  label: string;
  owner: string;
  note: string;
};

export type StatusSnapshot = {
  source: StatusSource;
  lastUpdated: string;
  components: StatusComponent[];
};

export type StatusCounts = Record<ComponentStatus, number>;

export type StatusSummary = {
  overallStatus: ComponentStatus;
  headline: string;
  counts: StatusCounts;
  totalComponents: number;
  impactedComponents: number;
};

export const statusSnapshot: StatusSnapshot = {
  source: {
    mode: 'local',
    label: 'Manual status snapshot',
    owner: 'GoldShore operations team',
    note: 'Maintained manually until a live status API/worker health feed is connected.',
  },
  lastUpdated: '2026-03-21T10:30:00Z',
  components: [
    {
      id: 'api-gateway',
      name: 'API Gateway',
      status: 'operational',
      detail:
        'Request routing, auth checks, and edge caching are operating normally.',
    },
    {
      id: 'web-application',
      name: 'Web Application',
      status: 'operational',
      detail:
        'Public web experiences and authenticated dashboards are serving normally.',
    },
    {
      id: 'background-workers',
      name: 'Background Workers',
      status: 'operational',
      detail:
        'Queue processing, automation jobs, and async notifications are operating normally.',
    },
  ],
};

const severityOrder: Record<ComponentStatus, number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  outage: 3,
};

const statusLabels: Record<ComponentStatus, string> = {
  operational: 'Operational',
  maintenance: 'Maintenance',
  degraded: 'Degraded performance',
  outage: 'Service outage',
};

export function getOverallStatus(
  components: StatusComponent[],
): ComponentStatus {
  return components.reduce<ComponentStatus>((currentWorst, component) => {
    return severityOrder[component.status] > severityOrder[currentWorst]
      ? component.status
      : currentWorst;
  }, 'operational');
}

export function getStatusLabel(status: ComponentStatus): string {
  return statusLabels[status];
}

export function getStatusCounts(components: StatusComponent[]): StatusCounts {
  return components.reduce<StatusCounts>(
    (counts, component) => ({
      ...counts,
      [component.status]: counts[component.status] + 1,
    }),
    {
      operational: 0,
      maintenance: 0,
      degraded: 0,
      outage: 0,
    },
  );
}

export function getStatusSummary(components: StatusComponent[]): StatusSummary {
  const overallStatus = getOverallStatus(components);
  const counts = getStatusCounts(components);
  const totalComponents = components.length;
  const impactedComponents =
    counts.maintenance + counts.degraded + counts.outage;

  if (overallStatus === 'outage') {
    return {
      overallStatus,
      headline: `${counts.outage} of ${totalComponents} monitored systems are currently experiencing an outage.`,
      counts,
      totalComponents,
      impactedComponents,
    };
  }

  if (overallStatus === 'degraded') {
    return {
      overallStatus,
      headline: `${counts.degraded} of ${totalComponents} monitored systems are currently experiencing degraded performance.`,
      counts,
      totalComponents,
      impactedComponents,
    };
  }

  if (overallStatus === 'maintenance') {
    return {
      overallStatus,
      headline: `${counts.maintenance} of ${totalComponents} monitored systems are in scheduled maintenance.`,
      counts,
      totalComponents,
      impactedComponents,
    };
  }

  return {
    overallStatus,
    headline: `All ${totalComponents} monitored systems are currently operational.`,
    counts,
    totalComponents,
    impactedComponents,
  };
}
