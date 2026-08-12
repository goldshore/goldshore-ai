import type { APIRoute } from 'astro';
import { authorizeAdminRequest, getAdminRouteRule } from '../../../utils/admin-access';
import { getSearchConsoleConfig, getSearchConsoleAccessToken, fetchTopQueries, fetchPerformanceMetrics } from '../../../lib/search-console';

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;
  const rule = getAdminRouteRule('/api/admin/search-console', 'GET');
  if (!rule) {
    return new Response('Not found.', { status: 404 });
  }

  const authResult = await authorizeAdminRequest(request, env as never, rule);
  if (!authResult.ok) {
    const failure = authResult as Extract<typeof authResult, { ok: false }>;
    return Response.json({ success: false, error: failure.error }, { status: failure.status });
  }

  const config = getSearchConsoleConfig(env);
  if (!config) {
    return Response.json({ success: false, error: 'Search Console not configured.' }, { status: 503 });
  }

  const accessToken = await getSearchConsoleAccessToken(config);
  if (!accessToken) {
    return Response.json({ success: false, error: 'Failed to authenticate with Search Console.' }, { status: 502 });
  }

  try {
    const [queries, metrics] = await Promise.all([
      fetchTopQueries(config, accessToken),
      fetchPerformanceMetrics(config, accessToken),
    ]);

    if (!queries || !metrics) {
      return Response.json({ success: false, error: 'Failed to fetch Search Console data.' }, { status: 502 });
    }

    const totalClicks = metrics.reduce((sum, m) => sum + m.clicks, 0);
    const totalImpressions = metrics.reduce((sum, m) => sum + m.impressions, 0);
    const avgPosition = metrics.length ? metrics.reduce((sum, m) => sum + m.position, 0) / metrics.length : 0;
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return Response.json({
      success: true,
      summary: { totalClicks, totalImpressions, avgPosition, avgCTR, period: `Last ${metrics.length} days` },
      metrics: metrics.slice(-7),
      topQueries: queries,
    });
  } catch {
    return Response.json({ success: false, error: 'Search Console request failed.' }, { status: 502 });
  }
};
