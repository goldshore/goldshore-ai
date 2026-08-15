import { Hono } from "hono";
import type { Env, Variables } from "../../types";

const chat = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// POST /admin/chat/message - Send message and get Claude response
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
