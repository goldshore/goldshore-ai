import { Hono } from "hono";
import type { Env, Variables } from "../../types";

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
    const messages = [
      ...context.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-1-20250805",
        max_tokens: 1024,
        system: systemContext,
        messages,
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

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const assistantMessage =
      data.content.find((block) => block.type === "text")?.text ||
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
