export async function listWorkflows(db: any, options: { offset: number; limit: number; type?: string }) {
  const where: string[] = [];
  const params: any[] = [];

  if (options.type) {
    where.push('type = ?');
    params.push(options.type);
  }

  const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';

  const total = await db.prepare(
    `SELECT COUNT(*) as count FROM workflows${whereClause}`
  ).bind(...params).first();

  const workflows = await db.prepare(
    `SELECT * FROM workflows${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, options.limit, options.offset).all();

  return {
    workflows: workflows.results || [],
    total: total?.count || 0,
    limit: options.limit,
    offset: options.offset,
  };
}

export async function getWorkflowById(db: any, id: string) {
  return await db.prepare('SELECT * FROM workflows WHERE id = ?').bind(id).first();
}

export async function createWorkflow(
  db: any,
  data: {
    id: string;
    name: string;
    type: string;
    description?: string;
    config: Record<string, any>;
    schedule?: string;
    created_by: string;
  }
) {
  return await db.prepare(
    `INSERT INTO workflows (id, name, type, description, config, schedule, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(
    data.id,
    data.name,
    data.type,
    data.description || null,
    JSON.stringify(data.config),
    data.schedule || null,
    'idle',
    data.created_by
  ).run();
}

export async function updateWorkflow(
  db: any,
  id: string,
  data: {
    name?: string;
    description?: string;
    config?: Record<string, any>;
    schedule?: string;
    status?: string;
  }
) {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
  }
  if (data.config !== undefined) {
    updates.push('config = ?');
    params.push(JSON.stringify(data.config));
  }
  if (data.schedule !== undefined) {
    updates.push('schedule = ?');
    params.push(data.schedule);
  }
  if (data.status !== undefined) {
    updates.push('status = ?');
    params.push(data.status);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  if (updates.length === 1) {
    throw new Error('No updates provided');
  }

  return await db.prepare(
    `UPDATE workflows SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...params).run();
}

export async function deleteWorkflow(db: any, id: string) {
  return await db.prepare('DELETE FROM workflows WHERE id = ?').bind(id).run();
}

export async function listWorkflowRuns(db: any, workflowId: string, options: { offset: number; limit: number }) {
  const runs = await db.prepare(
    `SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?`
  ).bind(workflowId, options.limit, options.offset).all();

  const total = await db.prepare(
    'SELECT COUNT(*) as count FROM workflow_runs WHERE workflow_id = ?'
  ).bind(workflowId).first();

  return {
    runs: runs.results || [],
    total: total?.count || 0,
    limit: options.limit,
    offset: options.offset,
  };
}

export async function createWorkflowRun(db: any, data: { id: string; workflow_id: string; status: string }) {
  return await db.prepare(
    `INSERT INTO workflow_runs (id, workflow_id, status, started_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(data.id, data.workflow_id, data.status).run();
}

export async function completeWorkflowRun(
  db: any,
  id: string,
  data: { status: string; result?: Record<string, any>; error?: string }
) {
  return await db.prepare(
    `UPDATE workflow_runs SET status = ?, completed_at = CURRENT_TIMESTAMP, result = ?, error = ? WHERE id = ?`
  ).bind(data.status, data.result ? JSON.stringify(data.result) : null, data.error || null, id).run();
}
