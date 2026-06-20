-- Paper positions ledger
CREATE TABLE IF NOT EXISTS paper_positions (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  quantity REAL NOT NULL,
  avg_cost REAL NOT NULL,
  side TEXT CHECK(side IN ('long','short')) NOT NULL,
  opened_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Paper orders (state machine)
CREATE TABLE IF NOT EXISTS paper_orders (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT CHECK(side IN ('buy','sell')) NOT NULL,
  quantity REAL NOT NULL,
  order_type TEXT CHECK(order_type IN ('market','limit','stop')) NOT NULL,
  limit_price REAL,
  status TEXT CHECK(status IN ('pending','open','filled','cancelled','rejected')) NOT NULL DEFAULT 'pending',
  fill_price REAL,
  fill_quantity REAL DEFAULT 0,
  source TEXT CHECK(source IN ('manual','agent')) NOT NULL DEFAULT 'manual',
  agent_recommendation_id TEXT,
  approved_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Closed positions archive
CREATE TABLE IF NOT EXISTS paper_closed_positions (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  quantity REAL NOT NULL,
  avg_cost REAL NOT NULL,
  close_price REAL NOT NULL,
  side TEXT NOT NULL,
  realized_pnl REAL NOT NULL,
  opened_at INTEGER NOT NULL,
  closed_at INTEGER NOT NULL
);

-- Agent recommendations (pending human approval)
CREATE TABLE IF NOT EXISTS agent_recommendations (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  symbol TEXT NOT NULL,
  action TEXT CHECK(action IN ('buy','sell','hold')) NOT NULL,
  quantity REAL,
  rationale TEXT,
  confidence REAL,
  status TEXT CHECK(status IN ('pending','approved','rejected','expired')) DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Notification log
CREATE TABLE IF NOT EXISTS notification_log (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  channel TEXT CHECK(channel IN ('email','webhook','sms')) NOT NULL,
  payload TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  success INTEGER NOT NULL DEFAULT 1
);
