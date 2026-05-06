import type { AnalysisRequest, AnalysisInput, ProviderName } from './types';

type RedactionResult = {
  text: string;
  redactions: number;
};

const PII_PATTERNS: RegExp[] = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
  /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
  /\b(?:\d[ -]*?){13,19}\b/g,
];

const redactText = (value: string): RedactionResult => {
  let redactions = 0;
  let text = value;

  for (const pattern of PII_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      redactions += matches.length;
      text = text.replace(pattern, '[REDACTED]');
    }
  }

  return { text, redactions };
};

const assertInputTypes = (input: AnalysisInput) => {
  if (typeof input.prompt !== 'string') {
    throw new Error('input.prompt must be a string');
  }

  if (input.context && !Array.isArray(input.context)) {
    throw new Error('input.context must be an array of strings');
  }

  if (input.context) {
    for (const item of input.context) {
      if (typeof item !== 'string') {
        throw new Error('input.context must contain only strings');
      }
    }
  }

  if (input.metadata) {
    if (Array.isArray(input.metadata) || typeof input.metadata !== 'object') {
      throw new Error('input.metadata must be an object');
    }

    for (const [key, value] of Object.entries(input.metadata)) {
      if (typeof key !== 'string') {
        throw new Error('input.metadata keys must be strings');
      }

      const allowed =
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null;

      if (!allowed) {
        throw new Error('input.metadata values must be string, number, boolean, or null');
      }
    }
  }
};

export type PolicyResult = {
  sanitized: AnalysisRequest;
  redactions: number;
};

export const applyAnalysisPolicy = (request: AnalysisRequest): PolicyResult => {
  if (!request || typeof request !== 'object') {
    throw new Error('request must be an object');
  }

  if (!request.provider) {
    throw new Error('provider is required');
  }

  const allowedProviders: ProviderName[] = ['openai', 'gemini'];
  if (!allowedProviders.includes(request.provider)) {
    throw new Error('provider must be openai or gemini');
  }

  if (!request.input) {
    throw new Error('input is required');
  }

  assertInputTypes(request.input);

  const promptResult = redactText(request.input.prompt);
  let redactions = promptResult.redactions;

  const context = request.input.context?.map((entry) => {
    const result = redactText(entry);
    redactions += result.redactions;
    return result.text;
  });

  let metadata: AnalysisInput['metadata'];
  if (request.input.metadata) {
    metadata = Object.fromEntries(
      Object.entries(request.input.metadata).map(([key, value]) => {
        if (typeof value === 'string') {
          const result = redactText(value);
          redactions += result.redactions;
          return [key, result.text];
        }
        return [key, value];
      }),
    );
  }

  return {
    sanitized: {
      provider: request.provider,
      input: {
        prompt: promptResult.text,
        context,
        metadata,
      },
    },
    redactions,
  };
};
