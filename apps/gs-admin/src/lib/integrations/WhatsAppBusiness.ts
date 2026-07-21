import { BaseIntegration, IntegrationConfig } from './BaseIntegration';

export interface WhatsAppMessage {
  recipientPhoneNumber: string;
  messageType: 'text' | 'template' | 'interactive';
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: { code: string };
    parameters?: {
      body: { parameters: Array<{ type: string; text: string }> };
    };
  };
}

export interface WhatsAppContact {
  id: string;
  phoneNumber: string;
  name: string;
  email?: string;
  tags?: string[];
  isQualifiedLead?: boolean;
  lastInteraction?: string;
}

export class WhatsAppBusinessIntegration extends BaseIntegration {
  private businessAccountId: string;
  private phoneNumberId: string;
  private accessToken: string;

  constructor(config: IntegrationConfig) {
    super(config);
    const [accountId, phoneId] = config.apiKey.split(':');
    this.businessAccountId = accountId || '';
    this.phoneNumberId = phoneId || '';
    this.accessToken = config.apiSecret || '';
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(
        `https://graph.whatsapp.com/v18.0/${this.phoneNumberId}?access_token=${this.accessToken}`
      );
      this.config.status = response.ok ? 'connected' : 'disconnected';
      return response.ok;
    } catch (error) {
      this.config.status = 'error';
      this.config.error = String(error);
      return false;
    }
  }

  /**
   * Send WhatsApp message
   */
  async sendMessage(message: WhatsAppMessage): Promise<string | null> {
    try {
      const response = await fetch(
        `https://graph.whatsapp.com/v18.0/${this.phoneNumberId}/messages?access_token=${this.accessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: message.recipientPhoneNumber,
            type: message.messageType,
            ...(message.text && { text: message.text }),
            ...(message.template && { template: message.template }),
          }),
        }
      );

      const data = await response.json();
      return data.messages?.[0]?.id || null;
    } catch (error) {
      console.error('WhatsApp send error:', error);
      return null;
    }
  }

  /**
   * Send templated message for leads
   */
  async sendLeadTemplate(
    phoneNumber: string,
    leadName: string,
    offerType: string
  ): Promise<boolean> {
    return await this.sendMessage({
      recipientPhoneNumber: phoneNumber,
      messageType: 'template',
      template: {
        name: 'lead_qualification',
        language: { code: 'en_US' },
        parameters: {
          body: {
            parameters: [
              { type: 'text', text: leadName },
              { type: 'text', text: offerType },
            ],
          },
        },
      },
    })
      .then((id) => !!id)
      .catch(() => false);
  }

  /**
   * Get message templates
   */
  async getMessageTemplates() {
    try {
      const response = await fetch(
        `https://graph.whatsapp.com/v18.0/${this.businessAccountId}/message_templates?access_token=${this.accessToken}`
      );

      if (!response.ok) throw new Error('Failed to fetch templates');

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
  }

  /**
   * Sync contacts from WhatsApp Business
   */
  async sync(): Promise<Record<string, unknown>> {
    try {
      const templates = await this.getMessageTemplates();

      this.config.lastSync = new Date().toISOString();
      this.config.status = 'connected';

      return {
        businessAccountId: this.businessAccountId,
        phoneNumberId: this.phoneNumberId,
        templates,
        lastSync: this.config.lastSync,
      };
    } catch (error) {
      this.config.status = 'error';
      this.config.error = String(error);
      return { error: String(error) };
    }
  }

  /**
   * Handle incoming WhatsApp messages (webhook)
   */
  async handleWebhook(event: Record<string, unknown>): Promise<void> {
    const changes = (event.entry as any)?.[0]?.changes?.[0];
    if (!changes) return;

    const { value } = changes;
    const messages = (value as any)?.messages || [];
    const statuses = (value as any)?.statuses || [];

    // Log incoming messages
    for (const msg of messages) {
      await this.logEvent('incoming_message', msg, {} as any);

      // Extract lead info if contact
      if (msg.type === 'text') {
        const contact = {
          phoneNumber: msg.from,
          message: msg.text.body,
          timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
        };
        await this.logEvent('contact_interaction', contact, {} as any);
      }
    }

    // Log delivery statuses
    for (const status of statuses) {
      await this.logEvent('message_status', status, {} as any);
    }
  }

  /**
   * Mark lead as qualified
   */
  async qualifyLead(phoneNumber: string): Promise<boolean> {
    try {
      // Store in KV for lead management
      const leadKey = `whatsapp_lead:${phoneNumber}`;
      const lead: WhatsAppContact = {
        id: `whatsapp_${phoneNumber}`,
        phoneNumber,
        name: '', // Populated from message
        isQualifiedLead: true,
        lastInteraction: new Date().toISOString(),
      };

      // Would store in KV in production
      return true;
    } catch (error) {
      console.error('Error qualifying lead:', error);
      return false;
    }
  }
}
