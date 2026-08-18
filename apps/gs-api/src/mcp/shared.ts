/**
 * Shared MCP utilities for goldshore-ai workflows
 */

import { McpServer, StdioServerTransport, Tool, TextContent } from '@modelcontextprotocol/server';
import { z } from 'zod';

export interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * Create error response for MCP tools
 */
export function createErrorResponse(message: string, details?: string): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${message}${details ? `\n${details}` : ''}`,
      },
    ],
    isError: true,
  };
}

/**
 * Create text response for MCP tools
 */
export function createTextResponse(text: string): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Create JSON response for MCP tools
 */
export function createJsonResponse(data: unknown): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Pagination input schema for list operations
 */
export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(20),
});

export type Pagination = z.infer<typeof PaginationSchema>;

/**
 * Safe API call wrapper with error handling
 */
export async function safeApiCall<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.error(`MCP Error [${context}]:`, error);
    return null;
  }
}

/**
 * Format ISO date for display
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString();
}

/**
 * Truncate text to max length
 */
export function truncate(text: string, maxLength: number = 500): string {
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}
