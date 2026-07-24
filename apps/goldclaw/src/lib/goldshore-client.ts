export interface Integration {
  id: string;
  name: string;
  provider: string;
  status: string;
  lastSyncAt?: string;
  secretsStatus: string;
}

export interface AdminAction {
  action: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt?: string;
}

export interface QueuedCommand {
  command: string;
  metadata: Record<string, unknown>;
  approval_method: 'whatsapp_reaction' | 'manual_ui';
  message: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  status: string;
  actor?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export class GoldShoreClient {
  private baseUrl: string;
  private bearerToken: string;

  constructor(baseUrl: string, bearerToken: string) {
    this.baseUrl = baseUrl;
    this.bearerToken = bearerToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  async getIntegrations(): Promise<Integration[]> {
    const data = await this.request<{ data: Integration[] }>(
      'GET',
      '/integrations?action=list'
    );
    return data.data || [];
  }

  async getIntegration(integrationId: string): Promise<Integration> {
    const integrations = await this.getIntegrations();
    const found = integrations.find((i) => i.id === integrationId);
    if (!found) {
      throw new Error(`Integration ${integrationId} not found`);
    }
    return found;
  }

  async getSecrets(integrationId: string): Promise<
    Array<{
      id: string;
      keyPrefix: string;
      keyType: string;
      createdAt: string;
      expiresAt?: string;
    }>
  > {
    const data = await this.request<{
      data: Array<{
        id: string;
        key_prefix: string;
        key_type: string;
        created_at: string;
        expires_at?: string;
      }>;
    }>('GET', `/integrations/keys?integration_id=${integrationId}`);

    return (data.data || []).map((s) => ({
      id: s.id,
      keyPrefix: s.key_prefix,
      keyType: s.key_type,
      createdAt: s.created_at,
      expiresAt: s.expires_at,
    }));
  }

  async rotateSecret(secretId: string, newKey: string): Promise<void> {
    await this.request('PATCH', `/integrations/keys/${secretId}`, {
      action: 'rotate',
      value: newKey,
    });
  }

  async verifySecret(secretId: string): Promise<{ valid: boolean }> {
    const data = await this.request<{ valid: boolean }>(
      'POST',
      `/integrations/keys/${secretId}/verify`,
      { integration_id: secretId }
    );
    return data;
  }

  async logAdminAction(action: AdminAction): Promise<void> {
    await this.request('POST', '/admin/actions/log', {
      action: action.action,
      status: action.status,
      metadata: action.metadata,
    });
  }

  async queueCommand(command: QueuedCommand): Promise<{ queueId: string }> {
    const data = await this.request<{ queueId: string }>(
      'POST',
      '/integrations/whatsapp/commands',
      command
    );
    return data;
  }

  async getCommandStatus(
    queueId: string
  ): Promise<{ status: string; result?: unknown; error?: string }> {
    const data = await this.request<{
      status: string;
      result?: unknown;
      error?: string;
    }>('GET', `/integrations/whatsapp/queue/${queueId}`);
    return data;
  }

  async getAuditTrail(
    integrationId?: string,
    days: number = 7
  ): Promise<AuditEntry[]> {
    let path = `/admin/audit?days=${days}`;
    if (integrationId) {
      path += `&integration_id=${integrationId}`;
    }

    const data = await this.request<{ data: AuditEntry[] }>('GET', path);
    return data.data || [];
  }

  async getRedactedStatuses(): Promise<
    Array<{
      id: string;
      name: string;
      lastError?: string;
      errorCount: number;
    }>
  > {
    const data = await this.request<{
      data: Array<{
        id: string;
        name: string;
        last_error?: string;
        error_count: number;
      }>;
    }>('GET', '/integrations?action=status');

    return (data.data || []).map((s) => ({
      id: s.id,
      name: s.name,
      lastError: s.last_error,
      errorCount: s.error_count,
    }));
  }
}
