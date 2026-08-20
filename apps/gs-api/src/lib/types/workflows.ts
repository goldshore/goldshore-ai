export type WorkflowType = 'leads_generator' | 'list_scraper' | 'email_sender' | 'tunnel_manager' | 'data_collector';

export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export interface Workflow {
  id: string;
  name: string;
  type: WorkflowType;
  description?: string;
  status: WorkflowStatus;
  config: Record<string, any>;
  schedule?: string;
  last_run?: string;
  next_run?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  result?: Record<string, any>;
  error?: string;
  duration_ms?: number;
}

export interface LeadsGeneratorConfig {
  source: 'linkedin' | 'crunchbase' | 'web';
  keywords: string[];
  location?: string;
  company_size?: 'startup' | 'scale' | 'enterprise';
  limit: number;
}

export interface ListScraperConfig {
  url: string;
  selector: string;
  fields: Record<string, string>;
  headers?: Record<string, string>;
}

export interface EmailSenderConfig {
  template_id: string;
  recipient_list: string[];
  subject: string;
  from_email: string;
  reply_to?: string;
  track_opens?: boolean;
  track_clicks?: boolean;
}

export interface TunnelManagerConfig {
  tunnel_name: string;
  action: 'create' | 'delete' | 'restart' | 'status';
  config?: Record<string, any>;
}
