/**
 * Admin PII Scans Route
 * GET /admin/pii-scans — Security scanning results for PII detection
 */

import { Hono, type Context } from 'hono';
import { buildAdminSession } from '@goldshore/auth';
import type { Env, Variables } from '../../types';

const piiScans = new Hono<{ Bindings: Env; Variables: Variables }>();

const verifyAdminAuth = (c: Context<{ Bindings: Env; Variables: Variables }>): { error: Response } | { ok: true } => {
  const claims = c.get('accessClaims');
  if (!claims) {
    return { error: c.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const session = buildAdminSession(claims);
  if (!session.permissions.includes('admin:security:read')) {
    return { error: c.json({ error: 'Insufficient permissions' }, { status: 403 }) };
  }
  return { ok: true };
};

/**
 * GET /admin/pii-scans?page=1&limit=15&severity=critical
 * Returns paginated PII scan results
 */
piiScans.get('/', async (c) => {
  const auth = verifyAdminAuth(c);
  if ('error' in auth) return auth.error;

  const claims = c.get('accessClaims');
  const severity = c.req.query('severity'); // 'critical' | 'high' | 'medium' | 'low'
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, parseInt(c.req.query('limit') || '15', 10));

  try {
    // Sample PII scan results (stub data until security scanning is implemented)
    const allScans = [
      {
        id: 'scan-001',
        scan_id: 'pii-scan-20260815-001',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed' as const,
        total_items_scanned: 1250,
        pii_found: 8,
        categories: {
          email: 3,
          phone: 2,
          ssn: 1,
          credit_card: 0,
          api_key: 2,
          other: 0,
        },
        severity: 'high' as const,
        details: 'Found 3 email addresses and 2 API keys in configuration files',
      },
      {
        id: 'scan-002',
        scan_id: 'pii-scan-20260814-002',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed' as const,
        total_items_scanned: 950,
        pii_found: 2,
        categories: {
          email: 0,
          phone: 0,
          ssn: 0,
          credit_card: 1,
          api_key: 1,
          other: 0,
        },
        severity: 'medium' as const,
        details: 'Test credit card number found in test data',
      },
      {
        id: 'scan-003',
        scan_id: 'pii-scan-20260813-003',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed' as const,
        total_items_scanned: 1100,
        pii_found: 0,
        categories: {
          email: 0,
          phone: 0,
          ssn: 0,
          credit_card: 0,
          api_key: 0,
          other: 0,
        },
        severity: 'low' as const,
        details: 'No sensitive data detected',
      },
    ];

    // Apply severity filter
    let filtered = allScans;
    if (severity) {
      filtered = filtered.filter((scan) => scan.severity === severity);
    }

    // Calculate pagination
    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginatedScans = filtered.slice(offset, offset + limit);

    // Calculate summary stats
    const totalPiiDetected = allScans.reduce((sum, scan) => sum + scan.pii_found, 0);

    console.info('[AUDIT] admin.pii-scans.read SUCCESS', {
      actor: claims?.email || 'unknown',
      total: total,
      returned: paginatedScans.length,
      page,
      severity,
    });

    return c.json({
      success: true,
      data: paginatedScans,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit),
      last_scan_time: allScans[0]?.timestamp,
      total_pii_detected: totalPiiDetected,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AUDIT] admin.pii-scans.read FAILED', {
      actor: claims?.email || 'unknown',
      error: errorMsg,
    });
    return c.json({ error: errorMsg }, 500);
  }
});

export default piiScans;
