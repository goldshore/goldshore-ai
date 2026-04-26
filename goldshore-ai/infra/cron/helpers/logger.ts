function sanitizeValue(value: any): any {
  if (value instanceof Error) {
    // Avoid logging full error objects which may contain sensitive data such as
    // environment-derived URLs, tokens, or file system paths. Only expose a
    // generic, non-sensitive representation.
    const safe: Record<string, unknown> = {
      name: value.name,
      // Do not include the original error message text as it may contain
      // secrets or environment-specific details.
      message: "An internal error occurred",
    };
    // Indicate that a stack was present without logging its contents.
    if (typeof value.stack === "string" && value.stack.length > 0) {
      safe.hasStack = true;
    }
    return safe;
  }
  return value;
}

function sanitizeArgs(args: any[]): any[] {
  const redactionPatterns: { re: RegExp; replacement: string }[] = [
    // Common secret-like key names
    { re: /(token|secret|password)\s*[:=]\s*["']?([A-Za-z0-9_\-\.]{4,})["']?/gi, replacement: "$1: [REDACTED]" },
    // Bearer tokens and long opaque values
    { re: /\bBearer\s+[A-Za-z0-9_\-\.+=\/]{8,}\b/gi, replacement: "Bearer [REDACTED]" },
  ];

  return args.map((arg) => {
    const sanitized = sanitizeValue(arg);
    if (typeof sanitized === "string") {
      let out = sanitized;
      for (const { re, replacement } of redactionPatterns) {
        out = out.replace(re, replacement);
      }
      return out;
    }
    if (sanitized && typeof sanitized === "object") {
      try {
        let json = JSON.stringify(sanitized);
        for (const { re, replacement } of redactionPatterns) {
          json = json.replace(re, replacement);
        }
        return json;
      } catch {
        return "[Unserializable object]";
      }
    }
    return sanitized;
  });
}

export function createLogger(context: string) {
  const prefix = `[${context}]`;
  const format = (level: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    // Use ISO string for timestamp, and standard level names
    return [`[${timestamp}] [${level}] ${prefix}`, ...args];
  };

  return {
    info: (...args: any[]) => console.log(...format("INFO", ...args)),
    warn: (...args: any[]) => console.warn(...format("WARN", ...args)),
    error: (...args: any[]) => {
      const safeArgs = sanitizeArgs(args);
      console.error(...format("ERROR", ...safeArgs));
    },
  };
}
