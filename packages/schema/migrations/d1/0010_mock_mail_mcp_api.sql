-- Mock development schema for GS admin integrations.
-- Production deployment requires review, backups, and an explicit migration run.

CREATE TABLE IF NOT EXISTS mail_messages (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'queued',
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_object_key TEXT,
  attachment_prefix TEXT,
  provider_message_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mail_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_object_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES mail_messages(id)
);

CREATE TABLE IF NOT EXISTS mcp_sessions (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  artifact_prefix TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS mcp_tool_calls (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  request_object_key TEXT,
  response_object_key TEXT,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES mcp_sessions(id)
);

CREATE TABLE IF NOT EXISTS api_requests (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  method TEXT NOT NULL,
  route TEXT NOT NULL,
  status_code INTEGER,
  request_object_key TEXT,
  response_object_key TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata_object_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mail_messages_status ON mail_messages(status, created_at);
CREATE INDEX IF NOT EXISTS idx_mail_events_message ON mail_events(message_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mcp_calls_session ON mcp_tool_calls(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_requests_route ON api_requests(route, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_events(resource_type, resource_id, created_at);
