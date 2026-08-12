import PostalMime from 'postal-mime';
import type { Env } from '../types';

const MAX_INBOUND_BYTES = 10 * 1024 * 1024;

const safeFilename = (filename: string | null | undefined, index: number) => {
  const normalized = (filename || `attachment-${index + 1}`)
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return normalized || `attachment-${index + 1}`;
};

const datePrefix = (date: Date) =>
  [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('/');

export async function archiveInboundEmail(message: ForwardableEmailMessage, env: Env) {
  if (!env.MAIL_ARCHIVE) {
    throw new Error('MAIL_ARCHIVE_NOT_CONFIGURED');
  }
  if (message.rawSize > MAX_INBOUND_BYTES) {
    throw new Error('INBOUND_EMAIL_TOO_LARGE');
  }

  const receivedAt = new Date();
  const id = crypto.randomUUID();
  const prefix = `mail/inbound/${datePrefix(receivedAt)}/${id}`;
  const raw = await new Response(message.raw).arrayBuffer();
  const parsed = await PostalMime.parse(raw);
  const rawObjectKey = `${prefix}/message.eml`;

  await env.MAIL_ARCHIVE.put(rawObjectKey, raw, {
    httpMetadata: { contentType: 'message/rfc822' },
    customMetadata: {
      envelopeFrom: message.from.slice(0, 512),
      envelopeTo: message.to.slice(0, 512),
    },
  });

  const attachmentKeys: string[] = [];
  for (const [index, attachment] of parsed.attachments.entries()) {
    const objectKey = `${prefix}/attachments/${index + 1}-${safeFilename(attachment.filename, index)}`;
    await env.MAIL_ARCHIVE.put(objectKey, attachment.content, {
      httpMetadata: {
        contentType: attachment.mimeType || 'application/octet-stream',
      },
    });
    attachmentKeys.push(objectKey);
  }

  const structuredObjectKey = `${prefix}/parsed.json`;
  await env.MAIL_ARCHIVE.put(
    structuredObjectKey,
    JSON.stringify({
      text: parsed.text || null,
      html: parsed.html || null,
      messageId: message.headers.get('message-id'),
      inReplyTo: message.headers.get('in-reply-to'),
      references: message.headers.get('references'),
      attachmentKeys,
    }),
    { httpMetadata: { contentType: 'application/json' } },
  );

  await env.PLATFORM_DB.prepare(
    `INSERT INTO inbound_messages
      (id, envelope_from, envelope_to, subject, message_id, in_reply_to, raw_object_key,
       parsed_object_key, attachment_count, status, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'archived', ?)`,
  )
    .bind(
      id,
      message.from,
      message.to,
      (parsed.subject || message.headers.get('subject') || 'No Subject').slice(0, 512),
      message.headers.get('message-id'),
      message.headers.get('in-reply-to'),
      rawObjectKey,
      structuredObjectKey,
      attachmentKeys.length,
      receivedAt.toISOString(),
    )
    .run();

  return { id, rawObjectKey, attachmentCount: attachmentKeys.length };
}
