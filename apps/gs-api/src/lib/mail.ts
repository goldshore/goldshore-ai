import { escapeHtml, isValidEmail } from '@goldshore/utils';
import type { Env } from '../types';

export type MailRecipient = {
  email: string;
  name?: string;
};

export type MailResult =
  | { attempted: false; reason: string }
  | { attempted: true; ok: boolean; status: number; body: string };

const RETRYABLE_EMAIL_ERRORS = new Set([
  'E_RATE_LIMIT_EXCEEDED',
  'E_DAILY_LIMIT_EXCEEDED',
  'E_DELIVERY_FAILED',
  'E_INTERNAL_SERVER_ERROR',
]);

const emailErrorCode = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'E_UNKNOWN';
  return String((error as { code?: unknown }).code ?? 'E_UNKNOWN');
};

export type MailEnv = Pick<Env, 'EMAIL' | 'MAIL_FROM_EMAIL' | 'MAIL_FROM_NAME'>;

export const isRetryableMailFailure = (result: MailResult) =>
  result.attempted && !result.ok && RETRYABLE_EMAIL_ERRORS.has(result.body);

export const sendMail = async (
  env: MailEnv,
  to: MailRecipient[],
  subject: string,
  text: string,
  html: string,
  replyTo?: MailRecipient,
): Promise<MailResult> => {
  const fromEmail = env.MAIL_FROM_EMAIL?.trim() || 'noreply@goldshore.ai';
  const fromName = env.MAIL_FROM_NAME?.trim() || 'GoldShore';
  if (!env.EMAIL || !isValidEmail(fromEmail) || to.length === 0) {
    return { attempted: false, reason: 'missing_mail_configuration' };
  }

  try {
    const response = await env.EMAIL.send({
      to: to.map((recipient) =>
        recipient.name ? { email: recipient.email, name: recipient.name } : recipient.email,
      ),
      from: { email: fromEmail, name: fromName },
      ...(replyTo
        ? {
            replyTo: replyTo.name
              ? { email: replyTo.email, name: replyTo.name }
              : replyTo.email,
          }
        : {}),
      subject,
      text,
      html,
    });

    return {
      attempted: true,
      ok: true,
      status: 202,
      body: response.messageId,
    };
  } catch (error) {
    const code = emailErrorCode(error);
    console.error({ event: 'mail_delivery_failed', code });
    return {
      attempted: true,
      ok: false,
      status: RETRYABLE_EMAIL_ERRORS.has(code) ? 503 : 400,
      body: code,
    };
  }
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

export function buildNewsletterConfirmation({
  confirmationUrl,
}: {
  confirmationUrl: string;
}) {
  const subject = 'Confirm your GoldShore newsletter subscription';
  const text = `Confirm your subscription by opening this link:

${confirmationUrl}

If you did not request this, ignore this email. You will not be subscribed.

${DEFAULT_SIGN_OFF}
`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h1 style="font-size: 22px;">Confirm your subscription</h1>
      <p>Use the button below to confirm that you want GoldShore updates.</p>
      <p><a href="${escapeHtml(confirmationUrl)}" style="display:inline-block;padding:12px 18px;background:#d3743e;color:#08080c;text-decoration:none;font-weight:700;">Confirm subscription</a></p>
      <p>If you did not request this, ignore this email. You will not be subscribed.</p>
      <p>${DEFAULT_SIGN_OFF}</p>
    </div>
  `;
  return { subject, text, html };
}

export function buildNewsletterWelcome({
  unsubscribeUrl,
}: {
  unsubscribeUrl: string;
}) {
  const subject = 'Your GoldShore subscription is confirmed';
  const text = `Your subscription is confirmed.

You will receive practical updates on applied intelligence, digital systems, and GoldShore projects.

Unsubscribe at any time:
${unsubscribeUrl}

${DEFAULT_SIGN_OFF}
`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h1 style="font-size: 22px;">Subscription confirmed</h1>
      <p>You will receive practical updates on applied intelligence, digital systems, and GoldShore projects.</p>
      <p><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe at any time</a>.</p>
      <p>${DEFAULT_SIGN_OFF}</p>
    </div>
  `;
  return { subject, text, html };
}
