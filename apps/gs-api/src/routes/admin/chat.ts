import { Hono } from "hono";
import type { Env, Variables } from "../../types";
import { TOOLS, toolDescriptors, callTool, callKnowledgeTool } from "../mcp";

const chat = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// System prompt with admin context
const SYSTEM_PROMPT = `You are an AI assistant for GoldShore's admin platform. You help operators with:
- Repository health monitoring (security issues, audit findings, deployment status)
- Lead and contact management (CRM operations, qualification tracking)
- Email and notification campaigns (queue status, template management)
- User and permission management
- Settings configuration
- Merge conflict resolution and deployment planning

When helping, be concise and actionable. Reference specific issues, PRs, or leads by their numbers.
Always suggest concrete next steps. You have access to the current system state through context provided below.`;

// POST /admin/chat/message - Send message with admin context
chat.post("/message", async (c) => {
  const claims = c.get("accessClaims");
  if (!claims?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json<{
      sessionId: string;
      message: string;
      context?: Array<{ role: string; content: string }>;
    }>();

    const { message, context = [] } = body;

    if (!message || !message.trim()) {
      return c.json({ error: "Message required" }, 400);
    }

    const apiKey = c.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[chat] ANTHROPIC_API_KEY not configured");
      return c.json({ error: "AI service not configured" }, 500);
    }

    // Gather system context (repo health, recent entries, etc.)
    let systemContext = SYSTEM_PROMPT;
    try {
      const db = c.env.PLATFORM_DB;
      if (db) {
        // Fetch recent critical findings
        const findings = await db
          .prepare(
            "SELECT id, issue_id, title, severity, status FROM repo_findings WHERE severity IN ('critical', 'high') ORDER BY created_at DESC LIMIT 3"
          )
          .all();

        if (findings.results && findings.results.length > 0) {
          systemContext += "\n\n## Current Critical Findings:\n";
          for (const finding of findings.results) {
            systemContext += `- #${finding.issue_id}: ${finding.title} (${finding.severity})\n`;
          }
        }

        // Fetch recent entries/leads
        const entries = await db
          .prepare(
            "SELECT id, name, status, created_at FROM entries ORDER BY created_at DESC LIMIT 5"
          )
          .all();

        if (entries.results && entries.results.length > 0) {
          systemContext += "\n## Recent Leads:\n";
          for (const entry of entries.results) {
            systemContext += `- ${entry.name} (${entry.status})\n`;
          }
        }
      }
    } catch (err) {
      console.warn("[chat] Could not load system context:", err);
      // Continue with base system prompt
    }

    // Build messages array for Claude API
    const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
      ...context.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ];

    const tools = toolDescriptors.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));

    // Tool-use loop: Claude may call MCP tools (Cloudflare listings, knowledge
    // search) before producing its final answer. Capped to avoid a runaway chain.
    const MAX_TOOL_ITERATIONS = 5;
    type ClaudeResponse = {
      content: Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;
      stop_reason: string;
    };
    let data: ClaudeResponse | undefined;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 1024,
          system: systemContext,
          messages,
          tools,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("[chat] Claude API error:", error);
        return c.json(
          { error: "Failed to get response from Claude" },
          response.status
        );
      }

      const parsed = (await response.json()) as ClaudeResponse;
      data = parsed;

      if (parsed.stop_reason !== "tool_use") break;

      messages.push({ role: "assistant", content: parsed.content });

      const toolResults = [];
      for (const block of parsed.content) {
        if (block.type !== "tool_use" || !block.name || !block.id) continue;
        const args = block.input ?? {};
        const toolResult =
          block.name === "goldshore_search_knowledge"
            ? await callKnowledgeTool(c.env, args)
            : await (async () => {
                const tool = TOOLS.find((candidate) => candidate.name === block.name);
                if (!tool) {
                  return { content: [{ type: "text", text: `Unknown tool: ${block.name}` }], isError: true };
                }
                return callTool(c.env, tool, args);
              })();
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: toolResult.content,
          ...(toolResult.isError ? { is_error: true } : {}),
        });
      }
      messages.push({ role: "user", content: toolResults });
    }

    const assistantMessage =
      data?.content.find((block) => block.type === "text")?.text ||
      "No response generated";

    return c.json({
      message: assistantMessage,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[chat] Error processing message:", msg);
    return c.json({ error: "Failed to process message" }, 500);
  }
});

export default chat;
