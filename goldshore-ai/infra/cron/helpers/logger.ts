function sanitizeValue(value: any): any {
  const redactionPatterns: { re: RegExp; replacement: string }[] = [
    { re: /(token|secret|password|api[_-]?key|authorization|account[_-]?id|zone[_-]?id)\s*[:=]\s*["']?([A-Za-z0-9_\-\.]{2,})["']?/gi, replacement: "$1: [REDACTED]" },
    { re: /\bBearer\s+[A-Za-z0-9_\-\.+=\/]{8,}\b/gi, replacement: "Bearer [REDACTED]" },
  ];
  const sensitiveKeyRe = /(token|secret|password|api[_-]?key|authorization|account[_-]?id|zone[_-]?id|cf_.*)/i;

  const redactText = (text: string): string => {
    let out = text;
    for (const { re, replacement } of redactionPatterns) {
      out = out.replace(re, replacement);
    }
    return out;
  };

  const sanitizeObject = (input: any): any => {
    if (input === null || input === undefined) return input;
    if (Array.isArray(input)) return input.map((v) => sanitizeObject(v));
    if (typeof input !== "object") return input;

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (sensitiveKeyRe.test(k)) {
        out[k] = "[REDACTED]";
      } else if (typeof v === "string") {
        out[k] = redactText(v);
      } else {
        out[k] = sanitizeObject(v);
      }
    }
    return out;
  };

  if (value instanceof Error) {
    const safe: Record<string, unknown> = {
      name: value.name,
      message: "An internal error occurred",
    };
    if (typeof value.stack === "string" && value.stack.length > 0) {
      safe.hasStack = true;
    }
    return safe;
  }

  if (typeof value === "string") return redactText(value);

  if (value && typeof value === "object") {
    return sanitizeObject(value);
  }

  return value;
}

function sanitizeArgs(args: any[]): any[] {
  return args.map((arg) => {
    const sanitized = sanitizeValue(arg);
    if (sanitized && typeof sanitized === "object") {
      try {
        return JSON.stringify(sanitized);
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
    info: (...args: any[]) => {
      const safeArgs = sanitizeArgs(args);
      console.log(...format("INFO", ...safeArgs));
    },
    warn: (...args: any[]) => {
      const safeArgs = sanitizeArgs(args);
      console.warn(...format("WARN", ...safeArgs));
    },
    error: (...args: any[]) => {
      const safeArgs = sanitizeArgs(args);
      console.error(...format("ERROR", ...safeArgs));
    },
  };
}
