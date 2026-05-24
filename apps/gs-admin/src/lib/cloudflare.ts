export type MetricPoint = {
  label: string;
  value: number;
  display: string;
};

export type ChartMetrics = {
  title: string;
  description: string;
  summary: string;
  trend: 'up' | 'down' | 'steady';
  series: MetricPoint[];
};

export type CloudflareMetrics = {
  source: 'live' | 'mock';
  refreshedAt: string;
  note: string;
  highlights: {
    totalRequests: string;
    cacheHitRate: string;
    threatsBlocked: string;
    dnsChanges: string;
  };
  charts: Record<string, ChartMetrics>;
};

type CloudflareRuntimeLocals = {
  runtime?: {
    env?: NodeJS.ProcessEnv;
  };
};

export function getCloudflareContext(locals: CloudflareRuntimeLocals) {
  return locals.runtime?.env || process.env;
}

export async function getCloudflareMetrics(): Promise<CloudflareMetrics> {
  return {
    source: 'mock',
    refreshedAt: new Date().toISOString(),
    note: 'Metrics are currently mocked for development and testing.',
    highlights: {
      totalRequests: '1.2M',
      cacheHitRate: '94.2%',
      threatsBlocked: '1,420',
      dnsChanges: '0'
    },
    charts: {
      requests: {
        title: 'Requests',
        description: 'Total requests over the last 7 days',
        summary: '+12.5%',
        trend: 'up',
        series: [
          { label: 'Mon', value: 150000, display: '150k' },
          { label: 'Tue', value: 165000, display: '165k' },
          { label: 'Wed', value: 180000, display: '180k' },
          { label: 'Thu', value: 175000, display: '175k' },
          { label: 'Fri', value: 190000, display: '190k' },
          { label: 'Sat', value: 140000, display: '140k' },
          { label: 'Sun', value: 130000, display: '130k' }
        ]
      },
      bandwidth: {
        title: 'Bandwidth',
        description: 'Data served from the edge',
        summary: '-2.1%',
        trend: 'down',
        series: [
          { label: 'Mon', value: 45, display: '45GB' },
          { label: 'Tue', value: 48, display: '48GB' },
          { label: 'Wed', value: 52, display: '52GB' },
          { label: 'Thu', value: 50, display: '50GB' },
          { label: 'Fri', value: 55, display: '55GB' },
          { label: 'Sat', value: 42, display: '42GB' },
          { label: 'Sun', value: 38, display: '38GB' }
        ]
      }
    }
  };
}
