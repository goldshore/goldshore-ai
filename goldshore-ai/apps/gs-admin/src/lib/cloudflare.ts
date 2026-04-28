type ChartPoint = { label: string; value: number; display: string };
type Chart = {
  title: string;
  summary: string;
  trend: 'up' | 'down' | 'steady';
  description: string;
  series: ChartPoint[];
};

export const getCloudflareMetrics = async () => ({
  source: 'mock',
  refreshedAt: new Date().toISOString(),
  note: 'Using local fallback metrics',
  highlights: {
    totalRequests: '1.2M',
    cacheHitRate: '87%',
    threatsBlocked: '14.8K',
    dnsChanges: '28',
  },
  charts: {
    traffic: {
      title: 'Traffic',
      summary: '+12%',
      trend: 'up',
      description: 'Requests over the last week',
      series: [
        { label: 'Mon', value: 78, display: '78k' },
        { label: 'Tue', value: 84, display: '84k' },
        { label: 'Wed', value: 92, display: '92k' },
      ],
    } satisfies Chart,
    threats: {
      title: 'Threats Blocked',
      summary: 'steady',
      trend: 'steady',
      description: 'WAF and bot mitigations',
      series: [
        { label: 'Mon', value: 11, display: '1.1k' },
        { label: 'Tue', value: 13, display: '1.3k' },
        { label: 'Wed', value: 12, display: '1.2k' },
      ],
    } satisfies Chart,
  },
});
