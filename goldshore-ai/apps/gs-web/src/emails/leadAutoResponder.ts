import { escapeHtml } from '../utils/security';

type AutoResponderInput = {
  name?: string;
  formType?: string;
};

const DEFAULT_SIGN_OFF = '— The GoldShore team';

export function buildLeadAutoResponder({ name, formType }: AutoResponderInput) {
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
  `.trim();

  return { subject, html, text };
}
