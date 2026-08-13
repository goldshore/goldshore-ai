-- Transactional mail delivery and inbound mailbox metadata for the unified
-- gs-api Worker. Message bodies and attachments are stored in R2, not D1.

CREATE TABLE IF NOT EXISTS mail_jobs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'retrying', 'sent', 'failed')),
  recipient_count INTEGER NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  recipient_hash TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  message_id TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_mail_jobs_status_created
  ON mail_jobs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS inbound_messages (
  id TEXT PRIMARY KEY,
  envelope_from TEXT NOT NULL,
  envelope_to TEXT NOT NULL,
  subject TEXT NOT NULL,
  message_id TEXT,
  in_reply_to TEXT,
  raw_object_key TEXT NOT NULL UNIQUE,
  parsed_object_key TEXT NOT NULL UNIQUE,
  attachment_count INTEGER NOT NULL DEFAULT 0 CHECK (attachment_count >= 0),
  status TEXT NOT NULL CHECK (status IN ('archived', 'forwarded', 'rejected', 'failed')),
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_messages_message_id
  ON inbound_messages(message_id)
  WHERE message_id IS NOT NULL AND message_id <> '';

CREATE INDEX IF NOT EXISTS idx_inbound_messages_received
  ON inbound_messages(received_at DESC);
