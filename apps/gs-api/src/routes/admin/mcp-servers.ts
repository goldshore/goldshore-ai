import { Hono } from 'hono';
import { requirePermission } from '../../auth';
import type { Env, Variables } from '../../types';
import { TOOLS, callKnowledgeTool, callTool, toolDescriptors } from '../mcp';

const mcpServers = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Admin view of the canonical MCP surface mounted by gs-api at /mcp. */
mcpServers.get('/servers', requirePermission('system:read'), (c) => c.json({
  success: true,
  transport: 'streamable-http',
  endpoint: 'https://mcp.goldshore.ai/mcp',
  servers: [{
    name: 'goldshore-mcp',
    description: 'Canonical GoldShore MCP server running inside gs-api',
    status: 'active',
    tools: toolDescriptors.map((tool) => ({ name: tool.name, description: tool.description })),
  }],
}));

mcpServers.post('/execute', requirePermission('system:write'), async (c) => {
  const body = await c.req.json<{
    server?: string;
    tool?: string;
    params?: Record<string, unknown>;
  }>().catch(() => null);
  if (!body?.server || !body.tool) return c.json({ error: 'Missing server or tool name.' }, 400);
  if (body.server !== 'goldshore-mcp') return c.json({ error: `Unknown server: ${body.server}` }, 404);

  const params = body.params ?? {};
  let result;
  if (body.tool === 'goldshore_search_knowledge') {
    result = await callKnowledgeTool(c.env, params);
  } else {
    const tool = TOOLS.find((candidate) => candidate.name === body.tool);
    if (!tool) return c.json({ error: `Unknown tool: ${body.tool}` }, 404);
    result = await callTool(c.env, tool, params);
  }

  return c.json({
    success: !result.isError,
    server: body.server,
    tool: body.tool,
    result,
    executedAt: new Date().toISOString(),
  }, result.isError ? 502 : 200);
});

mcpServers.get('/history', requirePermission('system:read'), (c) => {
  const url = new URL(c.req.url);
  const offset = Number.parseInt(url.searchParams.get('offset') || '0', 10);
  const limit = Math.min(Number.parseInt(url.searchParams.get('limit') || '25', 10), 100);
  return c.json({ success: true, items: [], total: 0, offset, limit, persisted: false,
    note: 'Execution history is not persisted yet; use Worker logs for current operational evidence.' });
});

export default mcpServers;
