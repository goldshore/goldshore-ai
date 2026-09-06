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

export type MailEnv = Pick<Env, 'EMAIL' | 'MAIL_FROM_EMAIL' | 'MAIL_FROM_NAME' | 'BREVO_API_KEY'>;

export const isRetryableMailFailure = (result: MailResult) =>
  result.attempted && !result.ok && (result.status === 429 || result.status >= 500 || RETRYABLE_EMAIL_ERRORS.has(result.body));

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
  const brevoApiKey = env.BREVO_API_KEY ? (await env.BREVO_API_KEY.get()).trim() : '';
  if ((!brevoApiKey && !env.EMAIL) || !isValidEmail(fromEmail) || to.length === 0) {
    return { attempted: false, reason: 'missing_mail_configuration' };
  }

  try {
    if (brevoApiKey) {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { email: fromEmail, name: fromName },
          to,
          ...(replyTo ? { replyTo } : {}),
          subject,
          textContent: text,
          htmlContent: html,
        }),
      });
      if (!response.ok) {
        const code = response.status === 429 ? 'E_RATE_LIMIT_EXCEEDED' : `E_BREVO_${response.status}`;
        console.error({ event: 'mail_delivery_failed', provider: 'brevo', code });
        return { attempted: true, ok: false, status: response.status, body: code };
      }
      const result = await response.json<{ messageId?: string }>().catch(() => ({}));
      return { attempted: true, ok: true, status: 202, body: result.messageId || 'BREVO_ACCEPTED' };
    }

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

const transactionalShell = (content: string, preheader: string) => `
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GoldShore</title></head>
  <body style="margin:0;background:#07080b;color:#f4f0e8;font-family:Arial,sans-serif;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07080b;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#111217;border:1px solid #2b2c32">
          <tr><td style="padding:24px 28px;border-bottom:1px solid #2b2c32;color:#d3743e;font-size:13px;font-weight:700;letter-spacing:.14em">GOLDSHORE</td></tr>
          <tr><td style="padding:32px 28px;color:#f4f0e8;line-height:1.65">${content}</td></tr>
          <tr><td style="padding:20px 28px;border-top:1px solid #2b2c32;color:#999aa2;font-size:12px">This operational message was sent by GoldShore. Questions? Reply or contact <a href="mailto:support@goldshore.ai" style="color:#d3743e">support@goldshore.ai</a>.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

const actionButton = (url: string, label: string) =>
  `<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 18px;background:#d3743e;color:#09080d;text-decoration:none;font-weight:700">${escapeHtml(label)}</a></p>`;

export function buildInvitationEmail({
  invitationUrl,
  role,
  expiresIn = '7 days',
}: {
  invitationUrl: string;
  role: string;
  expiresIn?: string;
}) {
  const safeRole = escapeHtml(role);
  const subject = 'You are invited to the GoldShore workspace';
  const text = `You have been invited to the GoldShore workspace with the ${role} role.\n\nAccept your invitation:\n${invitationUrl}\n\nThis invitation expires in ${expiresIn}. If you were not expecting it, you can ignore this email.\n\n${DEFAULT_SIGN_OFF}\n`;
  const html = transactionalShell(
    `<h1 style="margin:0 0 16px;font-size:28px">Workspace invitation</h1><p>You have been invited to the GoldShore workspace with the <strong>${safeRole}</strong> role.</p>${actionButton(invitationUrl, 'Accept invitation')}<p style="color:#b8b8bf;font-size:14px">This invitation expires in ${escapeHtml(expiresIn)}. If you were not expecting it, you can ignore this email.</p>`,
    'Your GoldShore workspace invitation is ready.',
  );
  return { subject, text, html };
}

export function buildActivationCodeEmail({ code, expiresIn = '10 minutes' }: { code: string; expiresIn?: string }) {
  const subject = 'Your GoldShore activation code';
  const text = `Your GoldShore activation code is ${code}. It expires in ${expiresIn}. Never share this code. If you did not request it, ignore this email.\n\n${DEFAULT_SIGN_OFF}\n`;
  const html = transactionalShell(
    `<h1 style="margin:0 0 16px;font-size:28px">Confirm your account</h1><p>Enter this one-time activation code:</p><p style="padding:18px;background:#090a0e;border:1px solid #34353d;font-family:monospace;font-size:28px;letter-spacing:.22em;text-align:center">${escapeHtml(code)}</p><p style="color:#b8b8bf;font-size:14px">It expires in ${escapeHtml(expiresIn)}. GoldShore will never ask you to share this code.</p>`,
    'Use this one-time code to confirm your GoldShore account.',
  );
  return { subject, text, html };
}

export function buildSecurityAlertEmail({
  action,
  occurredAt,
  location,
  reviewUrl,
}: {
  action: string;
  occurredAt: string;
  location?: string;
  reviewUrl: string;
}) {
  const subject = `Security alert: ${action}`;
  const locationLine = location ? `\nApproximate location: ${location}` : '';
  const text = `${action}\nTime: ${occurredAt}${locationLine}\n\nReview account activity:\n${reviewUrl}\n\nIf this was not you, secure your account immediately.\n\n${DEFAULT_SIGN_OFF}\n`;
  const html = transactionalShell(
    `<h1 style="margin:0 0 16px;font-size:28px">Security alert</h1><p><strong>${escapeHtml(action)}</strong></p><p>Time: ${escapeHtml(occurredAt)}${location ? `<br>Approximate location: ${escapeHtml(location)}` : ''}</p>${actionButton(reviewUrl, 'Review account activity')}<p>If this was not you, secure your account immediately.</p>`,
    `Security alert: ${action}`,
  );
  return { subject, text, html };
}

export function buildReceiptEmail({
  receiptNumber,
  amount,
  description,
  receiptUrl,
}: {
  receiptNumber: string;
  amount: string;
  description: string;
  receiptUrl?: string;
}) {
  const subject = `GoldShore receipt ${receiptNumber}`;
  const text = `Receipt ${receiptNumber}\n${description}\nTotal: ${amount}${receiptUrl ? `\n\nView receipt:\n${receiptUrl}` : ''}\n\n${DEFAULT_SIGN_OFF}\n`;
  const html = transactionalShell(
    `<h1 style="margin:0 0 16px;font-size:28px">Payment receipt</h1><p>Receipt <strong>${escapeHtml(receiptNumber)}</strong></p><p>${escapeHtml(description)}</p><p style="font-size:22px"><strong>Total: ${escapeHtml(amount)}</strong></p>${receiptUrl ? actionButton(receiptUrl, 'View receipt') : ''}`,
    `Receipt ${receiptNumber} from GoldShore.`,
  );
  return { subject, text, html };
}

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

  const html = transactionalShell(`
    <div>
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
  `, title);

  return { subject, text, html };
}

export function buildNewsletterConfirmation({
  confirmationUrl,
  activationCode,
}: {
  confirmationUrl: string;
  activationCode?: string;
}) {
  const subject = 'Confirm your GoldShore newsletter subscription';
  const text = `Confirm your subscription by opening this link:

${confirmationUrl}
${activationCode ? `\nOr enter this verification code: ${activationCode}\n` : ''}

If you did not request this, ignore this email. You will not be subscribed.

${DEFAULT_SIGN_OFF}
`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h1 style="font-size: 22px;">Confirm your subscription</h1>
      <p>Use the button below to confirm that you want GoldShore updates.</p>
      ${activationCode ? `<p style="padding:16px;background:#090a0e;color:#f5f1eb;font-family:monospace;font-size:24px;letter-spacing:.2em;text-align:center">${escapeHtml(activationCode)}</p>` : ''}
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
