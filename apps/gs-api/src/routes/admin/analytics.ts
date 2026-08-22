import type { Env, Variables } from '../../types';
import { Hono } from 'hono';
import { verifyAdminAuth, parsePagination, errorHandler } from './middleware/auth';

const analytics = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Apply auth middleware
analytics.use('*', verifyAdminAuth);
analytics.use('*', parsePagination);

/**
 * GET /api/admin/analytics/revenue-summary
 * Get revenue summary (total, by type, by channel)
 */
analytics.get('/revenue-summary', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const { offset, limit } = c.get('pagination');

  try {
    const summary = await db.prepare(`
      SELECT
        SUM(amount_cents) as total_revenue_cents,
        COUNT(*) as total_transactions,
        COUNT(DISTINCT org_id) as unique_orgs,
        status,
        revenue_type,
        channel,
        DATE(created_at) as date
      FROM revenue_events
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY status, revenue_type, channel, DATE(created_at)
      ORDER BY DATE(created_at) DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    return c.json({
      items: summary.results || [],
      offset,
      limit,
    });
  } catch (err) {
    throw new Error(`Failed to get revenue summary: ${err}`);
  }
}));

/**
 * GET /api/admin/analytics/subscription-stats
 * Get subscription tier statistics
 */
analytics.get('/subscription-stats', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;

  try {
    const stats = await db.prepare(`
      SELECT
        st.id,
        st.name,
        st.price_cents,
        st.billing_period,
        COUNT(us.id) as active_subscribers,
        SUM(CASE WHEN us.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
        SUM(CASE WHEN us.status = 'paused' THEN 1 ELSE 0 END) as paused_count
      FROM subscription_tiers st
      LEFT JOIN user_subscriptions us ON st.id = us.tier_id
      GROUP BY st.id, st.name, st.price_cents, st.billing_period
      ORDER BY st.price_cents DESC
    `).all();

    return c.json({
      items: stats.results || [],
    });
  } catch (err) {
    throw new Error(`Failed to get subscription stats: ${err}`);
  }
}));

/**
 * GET /api/admin/analytics/events-rollup
 * Get analytics events aggregated by type and time period
 */
analytics.get('/events-rollup', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const granularity = c.req.query('granularity') || 'daily'; // hourly, daily, monthly
  const daysBack = parseInt(c.req.query('days') || '30');

  let timeExpr = "DATE(hour)";
  if (granularity === 'hourly') {
    timeExpr = "strftime('%Y-%m-%d %H:00:00', hour)";
  } else if (granularity === 'monthly') {
    timeExpr = "strftime('%Y-%m-01', hour)";
  }

  try {
    const table = granularity === 'hourly' ? 'analytics_hourly'
                : granularity === 'monthly' ? 'analytics_monthly'
                : 'analytics_daily';

    const rollup = await db.prepare(`
      SELECT
        ${timeExpr} as time_period,
        event_type,
        SUM(count) as total_events,
        SUM(unique_users) as unique_users
      FROM ${table}
      WHERE ${granularity === 'hourly' ? 'hour' : 'day'} >= datetime('now', '-${daysBack} days')
      GROUP BY time_period, event_type
      ORDER BY time_period DESC, event_type ASC
    `).all();

    return c.json({
      items: rollup.results || [],
      granularity,
      days_back: daysBack,
    });
  } catch (err) {
    throw new Error(`Failed to get events rollup: ${err}`);
  }
}));

/**
 * GET /api/admin/analytics/market-data
 * Get recent market data feeds
 */
analytics.get('/market-data', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const symbol = c.req.query('symbol');
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 1000);

  let query = 'SELECT * FROM market_data_feeds';
  const params: any[] = [];

  if (symbol) {
    query += ' WHERE symbol = ?';
    params.push(symbol);
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  try {
    const data = await db.prepare(query).bind(...params).all();

    return c.json({
      items: data.results || [],
      count: data.results?.length || 0,
    });
  } catch (err) {
    throw new Error(`Failed to get market data: ${err}`);
  }
}));

/**
 * GET /api/admin/analytics/seo-metrics
 * Get SEO performance metrics
 */
analytics.get('/seo-metrics', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const domain = c.req.query('domain');
  const minRanking = parseInt(c.req.query('minRanking') || '0');
  const maxRanking = parseInt(c.req.query('maxRanking') || '100');

  const params: any[] = [minRanking, maxRanking];
  let whereClause = 'WHERE ranking_position BETWEEN ? AND ?';

  if (domain) {
    whereClause += ' AND domain = ?';
    params.push(domain);
  }

  try {
    const metrics = await db.prepare(`
      SELECT
        id,
        domain,
        keyword,
        ranking_position,
        volume,
        difficulty,
        traffic_potential,
        last_updated
      FROM seo_metrics
      ${whereClause}
      ORDER BY traffic_potential DESC, ranking_position ASC
      LIMIT 100
    `).bind(...params).all();

    return c.json({
      items: metrics.results || [],
      filter: { domain, minRanking, maxRanking },
    });
  } catch (err) {
    throw new Error(`Failed to get SEO metrics: ${err}`);
  }
}));

/**
 * GET /api/admin/analytics/risk-events
 * Get recent risk events by severity
 */
analytics.get('/risk-events', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const severity = c.req.query('severity');
  const daysBack = parseInt(c.req.query('days') || '7');

  let whereClause = `WHERE flagged_at >= datetime('now', '-${daysBack} days')`;
  const params: any[] = [];

  if (severity) {
    whereClause += ' AND severity = ?';
    params.push(severity);
  }

  try {
    const events = await db.prepare(`
      SELECT
        id,
        event_type,
        severity,
        description,
        flagged_at
      FROM risk_events
      ${whereClause}
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        flagged_at DESC
      LIMIT 100
    `).bind(...params).all();

    return c.json({
      items: events.results || [],
      filter: { severity, days_back: daysBack },
    });
  } catch (err) {
    throw new Error(`Failed to get risk events: ${err}`);
  }
}));

/**
 * POST /api/admin/analytics/record-event
 * Record a user event for analytics
 */
analytics.post('/record-event', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const user = c.get('user');
  const body = await c.req.json();

  const { org_id, event_type, resource_type, resource_id, action, metadata } = body;

  if (!event_type) {
    return c.json({ error: 'event_type required' }, 400);
  }

  try {
    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO analytics_events
      (id, org_id, user_id, event_type, resource_type, resource_id, action, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      org_id || null,
      user?.id || null,
      event_type,
      resource_type || null,
      resource_id || null,
      action || null,
      metadata ? JSON.stringify(metadata) : null
    ).run();

    return c.json({ success: true, event_id: id });
  } catch (err) {
    throw new Error(`Failed to record event: ${err}`);
  }
}));

/**
 * GET /api/admin/analytics/opportunities
 * Get business opportunities by status
 */
analytics.get('/opportunities', errorHandler(async (c) => {
  const db = c.env.PLATFORM_DB;
  const status = c.req.query('status');
  const { offset, limit } = c.get('pagination');

  let whereClause = '';
  const params: any[] = [];

  if (status) {
    whereClause = 'WHERE status = ?';
    params.push(status);
  }

  try {
    const result = await db.prepare(`
      SELECT
        id,
        org_id,
        title,
        description,
        category,
        status,
        value_cents,
        probability_percent,
        target_close_date,
        assigned_to,
        created_at,
        updated_at
      FROM opportunities
      ${whereClause}
      ORDER BY value_cents DESC, created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    const countResult = await db.prepare(`
      SELECT COUNT(*) as total FROM opportunities ${whereClause}
    `).bind(...params).first();

    return c.json({
      items: result.results || [],
      total: countResult?.total || 0,
      offset,
      limit,
      page: Math.floor(offset / limit) + 1,
    });
  } catch (err) {
    throw new Error(`Failed to get opportunities: ${err}`);
  }
}));

export default analytics;
