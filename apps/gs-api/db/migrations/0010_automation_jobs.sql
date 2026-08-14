-- Durable job and result storage for admin-owned lead generation, list scraping,
-- and first-party/public-web data collection workflows.

CREATE TABLE IF NOT EXISTS automation_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('lead_generator', 'list_scraper', 'data_collector')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  input_json TEXT NOT NULL,
  summary_json TEXT,
  error_code TEXT,
  requested_by TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_automation_jobs_status_created
  ON automation_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_kind_created
  ON automation_jobs(kind, created_at DESC);

CREATE TABLE IF NOT EXISTS automation_results (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES automation_jobs(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  result_type TEXT NOT NULL CHECK (result_type IN ('business_contact', 'page_record', 'crawl_error')),
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_automation_results_job
  ON automation_results(job_id, created_at ASC);
