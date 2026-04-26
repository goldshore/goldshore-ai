import { Hono } from "hono";

interface MailEnv {
  ENV?: string;
  MAIL_FORWARD_TO?: string;
  MAIL_ALLOWED_RECIPIENTS?: string;
  MAIL_BLOCKED_SENDERS?: string;
}

const app = new Hono<{ Bindings: MailEnv }>();

const normalizeList = (rawValue: string | undefined): string[] =>
  (rawValue ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

app.get("/", (c) => c.text("GoldShore Mail Worker"));
app.get("/health", (c) => c.json({ status: "ok", service: "gs-mail", env: c.env.ENV ?? "unknown" }));

export default {
  fetch: app.fetch,
  async email(message: ForwardableEmailMessage, env: MailEnv, _ctx: ExecutionContext): Promise<void> {
    const sender = message.from.toLowerCase();
    const recipient = message.to.toLowerCase();

    const blockedSenders = normalizeList(env.MAIL_BLOCKED_SENDERS);
    if (blockedSenders.includes(sender)) {
      message.setReject(`Sender ${sender} is blocked.`);
      return;
    }

    const allowedRecipients = normalizeList(env.MAIL_ALLOWED_RECIPIENTS);
    if (allowedRecipients.length > 0 && !allowedRecipients.includes(recipient)) {
      message.setReject(`Recipient ${recipient} is not allowed.`);
      return;
    }

    const forwardTo = env.MAIL_FORWARD_TO?.trim();
    if (!forwardTo) {
      message.setReject("Mail forwarding is not configured.");
      return;
    }

    await message.forward(forwardTo);
  },
};
