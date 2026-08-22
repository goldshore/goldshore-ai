-- Migration: 0003_workflow_performance.sql
-- Description: Add workflow performance monitoring tables for Phase 2 enhancements
-- Created: 2026-08-19
-- Author: Claude Code

-- Table: workflow_performance
-- Purpose: Store individual workflow run metrics for trend analysis
CREATE TABLE IF NOT EXISTS workflow_performance (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workflow_name TEXT NOT NULL,
  workflow_run_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'cancelled')),
  duration_sec INTEGER NOT NULL,
  actor TEXT,
  branch TEXT,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workflow_run_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_performance_name_timestamp ON workflow_performance(workflow_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_performance_timestamp ON workflow_performance(timestamp DESC);

-- Table: workflow_performance_trends
-- Purpose: Store calculated EMA (exponential moving average) trends
CREATE TABLE IF NOT EXISTS workflow_performance_trends (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workflow_name TEXT NOT NULL,
  ema_7day_sec REAL NOT NULL,
  ema_30day_sec REAL NOT NULL,
  regression_pct REAL,
  improvement_pct REAL,
  last_metric_count INTEGER DEFAULT 0,
  calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workflow_name, calculated_at)
);

CREATE INDEX IF NOT EXISTS idx_workflow_performance_trends_name_calculated ON workflow_performance_trends(workflow_name, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_performance_trends_calculated_at ON workflow_performance_trends(calculated_at DESC);

-- Table: workflow_performance_alerts
-- Purpose: Track performance regression alerts and resolutions
CREATE TABLE IF NOT EXISTS workflow_performance_alerts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workflow_name TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('regression', 'timeout_budget', 'failure_rate')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  threshold_value REAL NOT NULL,
  actual_value REAL NOT NULL,
  regression_pct REAL,
  github_issue_number INTEGER,
  slack_message_ts TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'acknowledged')),
  notes TEXT,
  triggered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_performance_alerts_status ON workflow_performance_alerts(workflow_name, status);
CREATE INDEX IF NOT EXISTS idx_workflow_performance_alerts_triggered_at ON workflow_performance_alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_performance_alerts_severity ON workflow_performance_alerts(severity);

-- Table: workflow_timeout_budgets
-- Purpose: Define and track timeout budgets for each workflow
CREATE TABLE IF NOT EXISTS workflow_timeout_budgets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workflow_name TEXT NOT NULL UNIQUE,
  timeout_minutes INTEGER NOT NULL,
  warning_pct INTEGER NOT NULL DEFAULT 80,
  critical_pct INTEGER NOT NULL DEFAULT 95,
  notes TEXT,
  last_reviewed_at DATETIME,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: workflow_regression_history
-- Purpose: Historical log of all detected regressions for analysis
CREATE TABLE IF NOT EXISTS workflow_regression_history (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workflow_name TEXT NOT NULL,
  detected_date DATE NOT NULL,
  regression_pct REAL NOT NULL,
  baseline_duration_sec INTEGER NOT NULL,
  actual_duration_sec INTEGER NOT NULL,
  probable_cause TEXT,
  action_taken TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_date DATE,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_regression_history_detected ON workflow_regression_history(workflow_name, detected_date DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_regression_history_detected_date ON workflow_regression_history(detected_date DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_regression_history_resolved ON workflow_regression_history(resolved);

-- View: workflow_performance_summary
-- Purpose: Current performance status for all workflows
CREATE VIEW IF NOT EXISTS workflow_performance_summary AS
SELECT
  wp.workflow_name,
  COUNT(wp.id) as runs_7day,
  AVG(wp.duration_sec) as avg_duration_sec,
  MIN(wp.duration_sec) as min_duration_sec,
  MAX(wp.duration_sec) as max_duration_sec,
  ROUND(SQRT(AVG((wp.duration_sec - (SELECT AVG(duration_sec) FROM workflow_performance WHERE workflow_name = wp.workflow_name AND timestamp > datetime('now', '-7 days'))) * (wp.duration_sec - (SELECT AVG(duration_sec) FROM workflow_performance WHERE workflow_name = wp.workflow_name AND timestamp > datetime('now', '-7 days')))))) as stddev_duration_sec,
  ROUND(100.0 * SUM(CASE WHEN wp.status = 'failure' THEN 1 ELSE 0 END) / COUNT(*)) as failure_rate_pct,
  wtb.timeout_minutes * 60 as timeout_sec,
  ROUND(100.0 * AVG(wp.duration_sec) / (wtb.timeout_minutes * 60)) as timeout_usage_pct,
  MAX(wp.timestamp) as last_run_at
FROM workflow_performance wp
LEFT JOIN workflow_timeout_budgets wtb ON wp.workflow_name = wtb.workflow_name
WHERE wp.timestamp > datetime('now', '-7 days')
GROUP BY wp.workflow_name;

-- View: regression_alerts_active
-- Purpose: Current active regression alerts requiring attention
CREATE VIEW IF NOT EXISTS regression_alerts_active AS
SELECT
  id,
  workflow_name,
  alert_type,
  severity,
  regression_pct,
  github_issue_number,
  triggered_at,
  ROUND((julianday('now') - julianday(triggered_at)) * 24) as hours_active
FROM workflow_performance_alerts
WHERE status IN ('open', 'acknowledged')
ORDER BY severity DESC, triggered_at ASC;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workflow_perf_7day ON workflow_performance(workflow_name, timestamp DESC) WHERE timestamp > datetime('now', '-7 days');
CREATE INDEX IF NOT EXISTS idx_workflow_perf_30day ON workflow_performance(workflow_name, timestamp DESC) WHERE timestamp > datetime('now', '-30 days');
CREATE INDEX IF NOT EXISTS idx_workflow_status_recent ON workflow_performance(status, timestamp DESC) WHERE timestamp > datetime('now', '-24 hours');

-- Sample data: Initialize timeout budgets for Phase 1 workflows
INSERT OR IGNORE INTO workflow_timeout_budgets (workflow_name, timeout_minutes, warning_pct, critical_pct, notes)
VALUES
  ('Deploy Goldshore API', 30, 80, 95, 'Production API deployment with health checks'),
  ('Deploy Goldshore Web', 30, 80, 95, 'Production frontend deployment'),
  ('Blue/Green Environment Promotion', 60, 80, 95, 'Safe promotion workflow with multi-layer validation'),
  ('Automated Rollback Triggers', 30, 80, 95, 'Continuous health monitoring and automatic rollback'),
  ('Apply D1 Migration', 15, 80, 95, 'Database migration application'),
  ('Migrate GS API D1', 20, 80, 95, 'GS API D1 migration with preview+production');
