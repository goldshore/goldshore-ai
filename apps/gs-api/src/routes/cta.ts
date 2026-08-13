/**
 * Call-to-Action (CTA) Routes
 *
 * Manages subscription CTAs, campaign tracking, and conversion metrics
 */

import { Router } from 'itty-router';
import type { IRequest } from 'itty-router';

interface CTARequest extends IRequest {
  campaign?: string;
  variant?: string;
  email?: string;
  source?: string;
}

interface CTAMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  conversion_rate: number;
}

export const ctaRouter = Router({ base: '/api/cta' });

/**
 * GET /api/cta/campaigns
 * List all active CTA campaigns
 */
ctaRouter.get('/campaigns', async (req: IRequest, env: any) => {
  try {
    const db = env.PLATFORM_DB;
    const campaigns = await db
      .prepare('SELECT * FROM cta_campaigns WHERE active = 1 ORDER BY created_at DESC')
      .all();

    return new Response(JSON.stringify(campaigns.results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch campaigns' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/**
 * GET /api/cta/campaigns/:id
 * Get campaign details
 */
ctaRouter.get('/campaigns/:id', async (req: IRequest, env: any) => {
  try {
    const { id } = req.params;
    const db = env.PLATFORM_DB;
    const campaign = await db
      .prepare('SELECT * FROM cta_campaigns WHERE id = ?')
      .bind(id)
      .first();

    if (!campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(campaign), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/**
 * POST /api/cta/campaigns
 * Create new CTA campaign
 */
ctaRouter.post('/campaigns', async (req: IRequest, env: any) => {
  try {
    const body = await req.json();
    const { name, variant, target_url, copy, active } = body;

    if (!name || !variant) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = env.PLATFORM_DB;
    const id = crypto.randomUUID();

    await db
      .prepare(`
        INSERT INTO cta_campaigns (id, name, variant, target_url, copy, active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(id, name, variant, target_url || '', copy || '', active ? 1 : 0)
      .run();

    return new Response(JSON.stringify({ id, name, variant, active }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/**
 * GET /api/cta/metrics/:campaign_id
 * Get campaign conversion metrics
 */
ctaRouter.get('/metrics/:campaign_id', async (req: IRequest, env: any) => {
  try {
    const { campaign_id } = req.params;
    const db = env.PLATFORM_DB;

    const metrics = await db
      .prepare(`
        SELECT
          COUNT(*) as total_events,
          SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END) as impressions,
          SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) as clicks,
          SUM(CASE WHEN event_type = 'conversion' THEN 1 ELSE 0 END) as conversions
        FROM cta_events
        WHERE campaign_id = ?
      `)
      .bind(campaign_id)
      .first();

    if (!metrics) {
      return new Response(JSON.stringify({ error: 'No metrics found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result: CTAMetrics = {
      impressions: metrics.impressions || 0,
      clicks: metrics.clicks || 0,
      conversions: metrics.conversions || 0,
      ctr: metrics.impressions ? (metrics.clicks / metrics.impressions) * 100 : 0,
      conversion_rate: metrics.clicks ? (metrics.conversions / metrics.clicks) * 100 : 0,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch metrics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/**
 * POST /api/cta/track
 * Track CTA event (impression, click, conversion)
 */
ctaRouter.post('/track', async (req: IRequest, env: any) => {
  try {
    const body = await req.json();
    const { campaign_id, event_type, email, source } = body;

    if (!campaign_id || !event_type) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = env.PLATFORM_DB;
    const id = crypto.randomUUID();

    await db
      .prepare(`
        INSERT INTO cta_events (id, campaign_id, event_type, email, source, timestamp)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(id, campaign_id, event_type, email || null, source || null)
      .run();

    return new Response(JSON.stringify({ id, tracked: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to track event' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/**
 * PUT /api/cta/campaigns/:id
 * Update campaign
 */
ctaRouter.put('/campaigns/:id', async (req: IRequest, env: any) => {
  try {
    const { id } = req.params;
    const body = await req.json();
    const db = env.PLATFORM_DB;

    await db
      .prepare(`
        UPDATE cta_campaigns
        SET name = ?, variant = ?, target_url = ?, copy = ?, active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(body.name, body.variant, body.target_url, body.copy, body.active ? 1 : 0, id)
      .run();

    return new Response(JSON.stringify({ updated: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

export default ctaRouter;
