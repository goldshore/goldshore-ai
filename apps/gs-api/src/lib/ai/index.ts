export * from './gateway';
export * from './openai-responses';
export * from './schema';
export * from './types';

/** Deny-by-default MCP policy. Add reviewed server/tool pairs explicitly. */
export const ALLOWED_MCP_SERVERS: Readonly<Record<string, readonly string[]>> = Object.freeze({});
