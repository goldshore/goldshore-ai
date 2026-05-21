function sanitizeArgs(args: any[]): any[] {
  const token = process.env.CF_API_TOKEN;
  const accountId = process.env.CF_ACCOUNT_ID;
  const zoneId = process.env.CF_ZONE_ID;

  const replacements: { value: string; replacement: string }[] = [];
  if (token) replacements.push({ value: token, replacement: "[REDACTED_TOKEN]" });
  if (accountId) {
    const suffix = accountId.slice(-4);
    replacements.push({ value: accountId, replacement: `[REDACTED_ACCOUNT_ID_*${suffix}]` });
  }
  if (zoneId) {
    const suffix = zoneId.slice(-4);
    replacements.push({ value: zoneId, replacement: `[REDACTED_ZONE_ID_*${suffix}]` });
  }

  return args.map((arg) => {
    // Leave non-string primitives and objects as-is unless they contain sensitive substrings
    let text: string;
    if (arg instanceof Error) {
      // Avoid logging full stack traces to reduce risk of leaking sensitive data; prefer the message
      text = arg.message || String(arg);
    } else if (typeof arg === "string") {
      text = arg;
    } else {
      try {
        text = JSON.stringify(arg);
      } catch {
        text = String(arg);
      }
    }

    let redacted = text;
    for (const { value, replacement } of replacements) {
      redacted = redacted.split(value).join(replacement);
    }

    // If we had to stringify a non-string argument, keep it as redacted string
    if (!(typeof arg === "string")) {
      return redacted;
    }
    return redacted;
  });
}

export function createLogger(context: string) {
  const prefix = `[${context}]`;
  const format = (level: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    // Use ISO string for timestamp, and standard level names
    const safeArgs = sanitizeArgs(args);
    return [`[${timestamp}] [${level}] ${prefix}`, ...safeArgs];
  };

  return {
    info: (...args: any[]) => console.log(...format("INFO", ...args)),
    warn: (...args: any[]) => console.warn(...format("WARN", ...args)),
    error: (...args: any[]) => console.error(...format("ERROR", ...args)),
  };
}
