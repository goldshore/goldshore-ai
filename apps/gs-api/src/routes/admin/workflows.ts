import type { Env, Variables } from '../../types';
import { Hono } from 'hono';
import { requireRbacPermission } from '../../middleware/requireRbacPermission';
import { errorHandler, parsePagination } from './middleware/auth';
import * as workflowsDb from './db/workflows';
import * as auditDb from './db/rbac-audit';
import type { EditorialProductionParams } from '../../workers/editorial-production';

const workflows = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

workflows.use('*', parsePagination);

// Generate random ID suffix for unique resource IDs
const randomId = (length: number) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

/**
 * GET /api/admin/workflows
 * List all workflows
 */
workflows.get(
  '/',
  await requireRbacPermission('perm_workers_view'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const { offset, limit } = c.get('pagination');
    const type = c.req.query('type');

    const result = await workflowsDb.listWorkflows(db, { offset, limit, type });

    return c.json({
      workflows: result.workflows,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  })
);

/**
 * POST /api/admin/workflows/editorial-production/run
 * Start the Cloudflare Workflow used by the GearSwipe production desk.
 * This creates drafts and gates only; it never publishes or distributes.
 */
workflows.post(
  '/editorial-production/run',
  await requireRbacPermission('perm_workers_update'),
  errorHandler(async (c) => {
    const workflow = c.env.EDITORIAL_PRODUCTION;
    if (!workflow) return c.json({ error: 'Editorial production workflow is not configured.' }, 503);

    let body: Partial<EditorialProductionParams>;
    try {
      body = (await c.req.json()) as Partial<EditorialProductionParams>;
    } catch {
      return c.json({ error: 'Invalid JSON payload.' }, 400);
    }

    if (!body.intakeId?.trim() || !body.objectId?.trim()) {
      return c.json({ error: 'intakeId and objectId are required.' }, 400);
    }
    if (body.sourceLeads !== undefined && (!Array.isArray(body.sourceLeads) || body.sourceLeads.some((lead) => typeof lead !== 'string'))) {
      return c.json({ error: 'sourceLeads must be an array of strings.' }, 400);
    }

    const params: EditorialProductionParams = {
      intakeId: body.intakeId.trim(),
      objectId: body.objectId.trim(),
      title: body.title?.trim(),
      sourceLeads: body.sourceLeads,
      rightsConfirmed: body.rightsConfirmed === true,
      evidenceConfirmed: body.evidenceConfirmed === true,
    };
    const id = `editorial-${crypto.randomUUID()}`;
    const instance = await workflow.create({ id, params });
    return c.json({ id: instance.id, workflow: 'editorial-production', status: 'queued' }, 202);
  }),
);

/**
 * GET /api/admin/workflows/:workflowId
 * Get single workflow
 */
workflows.get(
  '/:workflowId',
  await requireRbacPermission('perm_workers_view'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const workflowId = c.req.param('workflowId');

    const workflow = await workflowsDb.getWorkflowById(db, workflowId);
    if (!workflow) {
      return c.json({ error: 'Workflow not found' }, 404);
    }

    const runsResult = await workflowsDb.listWorkflowRuns(db, workflowId, { offset: 0, limit: 10 });

    return c.json({
      ...workflow,
      config: typeof workflow.config === 'string' ? JSON.parse(workflow.config) : workflow.config,
      recent_runs: runsResult.runs,
    });
  })
);

/**
 * POST /api/admin/workflows
 * Create workflow
 */
workflows.post(
  '/',
  await requireRbacPermission('perm_workers_update'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const user = c.get('user');
    const body = (await c.req.json()) as any;

    if (!body.name || !body.type || !body.config) {
      return c.json(
        { error: 'Missing required fields: name, type, config' },
        400
      );
    }

    const workflowId = `wf_${body.type}_${randomId(8)}`;
    await workflowsDb.createWorkflow(db, {
      id: workflowId,
      name: body.name,
      type: body.type,
      description: body.description,
      config: body.config,
      schedule: body.schedule,
      created_by: user.email,
    });

    await auditDb.createAuditEntry(db, {
      actorEmail: user.email,
      action: 'created_workflow',
      targetType: 'workflow',
      targetId: workflowId,
      targetName: body.name,
      changes: { type: body.type },
      reason: body.reason,
      ipAddress: c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });

    return c.json(
      {
        id: workflowId,
        name: body.name,
        type: body.type,
        status: 'idle',
        created_at: new Date().toISOString(),
      },
      201
    );
  })
);

/**
 * PATCH /api/admin/workflows/:workflowId
 * Update workflow
 */
workflows.patch(
  '/:workflowId',
  await requireRbacPermission('perm_workers_update'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const workflowId = c.req.param('workflowId');
    const user = c.get('user');
    const body = (await c.req.json()) as any;

    const workflow = await workflowsDb.getWorkflowById(db, workflowId);
    if (!workflow) {
      return c.json({ error: 'Workflow not found' }, 404);
    }

    await workflowsDb.updateWorkflow(db, workflowId, {
      name: body.name,
      description: body.description,
      config: body.config,
      schedule: body.schedule,
      status: body.status,
    });

    await auditDb.createAuditEntry(db, {
      actorEmail: user.email,
      action: 'updated_workflow',
      targetType: 'workflow',
      targetId: workflowId,
      targetName: workflow.name,
      changes: body,
      reason: body.reason,
      ipAddress: c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });

    return c.json({ success: true, message: 'Workflow updated' });
  })
);

/**
 * DELETE /api/admin/workflows/:workflowId
 * Delete workflow
 */
workflows.delete(
  '/:workflowId',
  await requireRbacPermission('perm_workers_update'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const workflowId = c.req.param('workflowId');
    const user = c.get('user');

    const workflow = await workflowsDb.getWorkflowById(db, workflowId);
    if (!workflow) {
      return c.json({ error: 'Workflow not found' }, 404);
    }

    await workflowsDb.deleteWorkflow(db, workflowId);

    await auditDb.createAuditEntry(db, {
      actorEmail: user.email,
      action: 'deleted_workflow',
      targetType: 'workflow',
      targetId: workflowId,
      targetName: workflow.name,
      reason: c.req.query('reason'),
      ipAddress: c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });

    return c.json({ success: true, message: 'Workflow deleted' });
  })
);

/**
 * POST /api/admin/workflows/:workflowId/run
 * Trigger workflow execution
 */
workflows.post(
  '/:workflowId/run',
  await requireRbacPermission('perm_workers_update'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const workflowId = c.req.param('workflowId');
    const queues = c.env.JOBS_QUEUE;

    const workflow = await workflowsDb.getWorkflowById(db, workflowId);
    if (!workflow) {
      return c.json({ error: 'Workflow not found' }, 404);
    }

    const runId = `run_${randomId(12)}`;
    await workflowsDb.createWorkflowRun(db, {
      id: runId,
      workflow_id: workflowId,
      status: 'running',
    });

    await queues.send({
      type: 'workflow_execute',
      workflowId,
      runId,
      config: typeof workflow.config === 'string' ? JSON.parse(workflow.config) : workflow.config,
      workflowType: workflow.type,
    });

    return c.json(
      {
        run_id: runId,
        status: 'running',
        started_at: new Date().toISOString(),
      },
      202
    );
  })
);

/**
 * GET /api/admin/workflows/:workflowId/runs
 * List workflow runs
 */
workflows.get(
  '/:workflowId/runs',
  await requireRbacPermission('perm_workers_view'),
  errorHandler(async (c) => {
    const db = c.env.PLATFORM_DB;
    const workflowId = c.req.param('workflowId');
    const { offset, limit } = c.get('pagination');

    const result = await workflowsDb.listWorkflowRuns(db, workflowId, { offset, limit });

    return c.json({
      runs: result.runs,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  })
);

export default workflows;
