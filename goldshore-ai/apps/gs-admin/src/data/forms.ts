export interface FormConfig {
  slug: string;
  name: string;
  status: 'active' | 'paused' | 'draft';
  description: string;
  recipients: Array<{ name: string; channel: string }>;
  integrations: Array<{ name: string; type: string; status: 'enabled' | 'disabled' }>;
  fields: Array<{ label: string; type: string; required?: boolean }>;
  submissionStatus: { received: number; stored: number; routed: number; failed: number };
  lastUpdated: string;
}

export const formConfigs: FormConfig[] = [
  {
    slug: 'contact',
    name: 'Contact Intake',
    status: 'active',
    description: 'Primary inbound contact form for sales and support.',
    recipients: [
      { name: 'Sales Ops', channel: 'email' },
      { name: 'Support Desk', channel: 'email' },
    ],
    integrations: [{ name: 'gs-mail', type: 'worker', status: 'enabled' }],
    fields: [
      { label: 'Name', type: 'text', required: true },
      { label: 'Email', type: 'email', required: true },
      { label: 'Message', type: 'textarea', required: true },
    ],
    submissionStatus: { received: 128, stored: 128, routed: 126, failed: 2 },
    lastUpdated: '2026-02-15',
  },
];

export const getFormConfig = (slug: string): FormConfig | undefined =>
  formConfigs.find((config) => config.slug === slug);
