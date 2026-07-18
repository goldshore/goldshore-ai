import { escapeHtml, isValidEmail } from '@goldshore/utils';
import type { Env } from '../types';

const DEFAULT_MAILCHANNELS_API_URL = 'https://api.mailchannels.net/tx/v1/send';

export type MailRecipient = {
  email: string;
  name?: string;
};

export type MailResult =
  | { attempted: false; reason: string }
  | { attempted: true; ok: boolean; status: number; body: string };

export const sendMail = async (
  env: Env,
  to: MailRecipient[],
  subject: string,
  text: string,
  html: string,
  replyTo?: MailRecipient,
): Promise<MailResult> => {
  const fromEmail = env.MAILCHANNELS_SENDER_EMAIL?.trim();
  const fromName = env.MAILCHANNELS_SENDER_NAME?.trim() || 'GoldShore';
  if (!fromEmail || !isValidEmail(fromEmail) || to.length === 0) {
    return { attempted: false, reason: 'missing_mail_configuration' };
  }

  const payload = {
    personalizations: [{ to }],
    from: { email: fromEmail, name: fromName },
    ...(replyTo ? { reply_to: replyTo } : {}),
    subject,
    content: [
      { type: 'text/plain', value: text },
      { type: 'text/html', value: html },
    ],
  };

  const endpoint = env.MAILCHANNELS_API_URL || DEFAULT_MAILCHANNELS_API_URL;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return { attempted: true, ok: response.ok, status: response.status, body: await response.text() };
};

export const parseNotificationRecipients = (
  configRecipients: Array<{ email?: string; name?: string }>,
  fallbackRecipients: string | undefined,
): MailRecipient[] => {
  const fromConfig = configRecipients
    .filter((recipient): recipient is { email: string; name?: string } =>
      typeof recipient.email === 'string' && isValidEmail(recipient.email),
    )
    .map((recipient) => ({ email: recipient.email, name: recipient.name }));

  if (fromConfig.length > 0) return fromConfig;

  return (fallbackRecipients ?? '')
    .split(',')
    .map((recipient) => recipient.trim())
    .filter((email) => isValidEmail(email))
    .map((email) => ({ email }));
};

const DEFAULT_SIGN_OFF = '— The GoldShore team';

export function buildLeadAutoResponder({ name, formType }: { name?: string; formType?: string }) {
  const friendlyName = name?.trim() ? escapeHtml(name.trim()) : 'there';
  const title =
    formType === 'lead-qualification'
      ? 'Thanks for sharing your project intake'
      : 'Thanks for getting in touch with GoldShore';

  const intro =
    formType === 'lead-qualification'
      ? 'We are reviewing the details you shared and will follow up with next steps.'
      : 'We have your message and will respond with a tailored plan shortly.';

  const nextSteps =
    formType === 'lead-qualification'
      ? [
          'Our team will review your goals and constraints.',
          'We will confirm scope, timelines, and fit.',
          'You will receive a tailored response within one business day.',
        ]
      : [
          'We will review your message.',
          'We will propose a clear path forward.',
          'Expect a response within one business day.',
        ];

  const subject = `${title} | GoldShore`;
  const text = `Hi ${friendlyName},

${intro}

Next steps:
${nextSteps.map((step) => `• ${step}`).join('\n')}

If you have additional details, reply to this email or contact us at hello@goldshore.ai.

${DEFAULT_SIGN_OFF}
`;

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hi ${friendlyName},</p>
      <p>${intro}</p>
      <p><strong>Next steps</strong></p>
      <ul>
        ${nextSteps.map((step) => `<li>${step}</li>`).join('')}
      </ul>
      <p>
        If you have additional details, reply to this email or contact us at
        <a href="mailto:hello@goldshore.ai">hello@goldshore.ai</a>.
      </p>
      <p>${DEFAULT_SIGN_OFF}</p>
    </div>
  `;

  return { subject, text, html };
}
