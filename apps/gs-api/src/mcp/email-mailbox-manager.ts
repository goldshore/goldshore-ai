/**
 * MCP Server for Email Mailbox Management
 * Enables workflows for email sending, templating, queue management, and IMAP access
 */

import { McpServer, StdioServerTransport } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  createErrorResponse,
  createTextResponse,
  createJsonResponse,
  PaginationSchema,
  safeApiCall,
  formatDate,
  truncate,
} from './shared';

/**
 * Email API client wrapper
 */
class EmailClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.resend.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Email API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async sendEmail(data: {
    from: string;
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    reply_to?: string;
    cc?: string[];
    bcc?: string[];
  }) {
    return this.request('POST', '/emails', data);
  }

  async getEmailStatus(emailId: string) {
    return this.request('GET', `/emails/${emailId}`);
  }

  async listEmails(page: number = 1, limit: number = 20) {
    return this.request('GET', `/emails?page=${page}&limit=${limit}`);
  }

  async createTemplate(data: {
    name: string;
    subject: string;
    html: string;
    description?: string;
  }) {
    return this.request('POST', '/templates', data);
  }

  async getTemplate(templateId: string) {
    return this.request('GET', `/templates/${templateId}`);
  }

  async listTemplates(page: number = 1, limit: number = 20) {
    return this.request('GET', `/templates?page=${page}&limit=${limit}`);
  }

  async sendBatch(emails: Array<{ to: string; subject: string; html: string }>) {
    return this.request('POST', '/emails/batch', { emails });
  }
}

/**
 * Initialize Email Mailbox Manager MCP Server
 */
export async function initEmailMailboxManager() {
  const emailApiKey = process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY || '';
  if (!emailApiKey) {
    console.warn('EMAIL_API_KEY not set - Email Mailbox Manager will not function');
  }

  const client = new EmailClient(emailApiKey);
  const server = new McpServer({
    name: 'email-mailbox-manager',
    version: '1.0.0',
  });

  // Send Email
  server.registerTool(
    'email_send',
    {
      description: 'Send an email message',
      inputSchema: z.object({
        from: z.string().email().describe('Sender email address'),
        to: z.union([z.string().email(), z.array(z.string().email())]).describe('Recipient(s)'),
        subject: z.string().describe('Email subject'),
        html: z.string().optional().describe('HTML body'),
        text: z.string().optional().describe('Plain text body'),
        reply_to: z.string().email().optional().describe('Reply-to address'),
        cc: z.array(z.string().email()).optional().describe('CC recipients'),
        bcc: z.array(z.string().email()).optional().describe('BCC recipients'),
      }),
    },
    async (params) => {
      const result = await safeApiCall(
        () =>
          client.sendEmail({
            from: params.from,
            to: params.to,
            subject: params.subject,
            html: params.html,
            text: params.text,
            reply_to: params.reply_to,
            cc: params.cc,
            bcc: params.bcc,
          }),
        'send_email'
      );

      if (!result) {
        return createErrorResponse('Failed to send email');
      }

      return createJsonResponse({
        status: 'sent',
        email_id: (result as any).id,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Get Email Status
  server.registerTool(
    'email_get_status',
    {
      description: 'Check the delivery status of a sent email',
      inputSchema: z.object({
        email_id: z.string().describe('Email ID from send operation'),
      }),
    },
    async (params) => {
      const email = await safeApiCall(
        () => client.getEmailStatus(params.email_id),
        'get_email_status'
      );

      if (!email) {
        return createErrorResponse('Failed to fetch email status');
      }

      return createJsonResponse({
        id: (email as any).id,
        from: (email as any).from,
        to: (email as any).to,
        subject: (email as any).subject,
        status: (email as any).status,
        created_at: formatDate((email as any).created_at),
      });
    }
  );

  // Create Email Template
  server.registerTool(
    'email_create_template',
    {
      description: 'Create a reusable email template',
      inputSchema: z.object({
        name: z.string().describe('Template name'),
        subject: z.string().describe('Email subject line'),
        html: z.string().describe('HTML template body'),
        description: z.string().optional().describe('Template description'),
      }),
    },
    async (params) => {
      const template = await safeApiCall(
        () =>
          client.createTemplate({
            name: params.name,
            subject: params.subject,
            html: params.html,
            description: params.description,
          }),
        'create_template'
      );

      if (!template) {
        return createErrorResponse('Failed to create email template');
      }

      return createJsonResponse({
        template_id: (template as any).id,
        name: params.name,
        status: 'created',
      });
    }
  );

  // Get Email Template
  server.registerTool(
    'email_get_template',
    {
      description: 'Retrieve an email template',
      inputSchema: z.object({
        template_id: z.string().describe('Template ID'),
      }),
    },
    async (params) => {
      const template = await safeApiCall(
        () => client.getTemplate(params.template_id),
        'get_template'
      );

      if (!template) {
        return createErrorResponse('Failed to fetch email template');
      }

      return createJsonResponse({
        id: (template as any).id,
        name: (template as any).name,
        subject: (template as any).subject,
        html: truncate((template as any).html),
        created_at: formatDate((template as any).created_at),
      });
    }
  );

  // List Email Templates
  server.registerTool(
    'email_list_templates',
    {
      description: 'List all email templates',
      inputSchema: PaginationSchema,
    },
    async (params) => {
      const templates = await safeApiCall(
        () => client.listTemplates(params.page, params.limit),
        'list_templates'
      );

      if (!templates) {
        return createErrorResponse('Failed to fetch email templates');
      }

      const templateList = Array.isArray((templates as any).data)
        ? (templates as any).data.map((t: any) => ({
            id: t.id,
            name: t.name,
            subject: t.subject,
            created_at: formatDate(t.created_at),
          }))
        : [];

      return createJsonResponse(templateList);
    }
  );

  // Send Batch Emails
  server.registerTool(
    'email_send_batch',
    {
      description: 'Send multiple emails at once',
      inputSchema: z.object({
        emails: z
          .array(
            z.object({
              to: z.string().email().describe('Recipient email'),
              subject: z.string().describe('Email subject'),
              html: z.string().describe('HTML body'),
            })
          )
          .describe('Array of emails to send'),
      }),
    },
    async (params) => {
      const result = await safeApiCall(
        () => client.sendBatch(params.emails),
        'send_batch'
      );

      if (!result) {
        return createErrorResponse('Failed to send batch emails');
      }

      return createJsonResponse({
        status: 'batch_submitted',
        count: params.emails.length,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // List Recent Emails
  server.registerTool(
    'email_list_recent',
    {
      description: 'List recently sent emails',
      inputSchema: PaginationSchema,
    },
    async (params) => {
      const emails = await safeApiCall(
        () => client.listEmails(params.page, params.limit),
        'list_emails'
      );

      if (!emails) {
        return createErrorResponse('Failed to fetch email list');
      }

      const emailList = Array.isArray((emails as any).data)
        ? (emails as any).data.map((e: any) => ({
            id: e.id,
            from: e.from,
            to: e.to,
            subject: e.subject,
            status: e.status,
            created_at: formatDate(e.created_at),
          }))
        : [];

      return createJsonResponse(emailList);
    }
  );

  // Send from Template
  server.registerTool(
    'email_send_from_template',
    {
      description: 'Send an email using a template with variable substitution',
      inputSchema: z.object({
        template_id: z.string().describe('Template ID'),
        to: z.union([z.string().email(), z.array(z.string().email())]).describe('Recipient(s)'),
        from: z.string().email().describe('Sender email'),
        variables: z
          .record(z.string(), z.string())
          .optional()
          .describe('Template variables for substitution'),
      }),
    },
    async (params) => {
      const template = await safeApiCall(
        () => client.getTemplate(params.template_id),
        'send_from_template'
      );

      if (!template) {
        return createErrorResponse('Template not found');
      }

      // Simple variable substitution
      let html = (template as any).html;
      let subject = (template as any).subject;

      if (params.variables) {
        Object.entries(params.variables).forEach(([key, value]) => {
          const placeholder = new RegExp(`{{${key}}}`, 'g');
          html = html.replace(placeholder, value);
          subject = subject.replace(placeholder, value);
        });
      }

      const result = await safeApiCall(
        () =>
          client.sendEmail({
            from: params.from,
            to: params.to,
            subject,
            html,
          }),
        'send_email'
      );

      if (!result) {
        return createErrorResponse('Failed to send email from template');
      }

      return createJsonResponse({
        status: 'sent',
        email_id: (result as any).id,
        template_id: params.template_id,
      });
    }
  );

  return server;
}

/**
 * Start the MCP server
 */
export async function startEmailMailboxManager() {
  const server = await initEmailMailboxManager();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('Email Mailbox Manager MCP server started');
}
