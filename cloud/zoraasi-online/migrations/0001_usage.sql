CREATE TABLE IF NOT EXISTS usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp_utc TEXT NOT NULL,
  utc_date TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  estimated INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS usage_date_model ON usage(utc_date, model);

CREATE TABLE IF NOT EXISTS daily_budget (
  utc_date TEXT NOT NULL,
  model TEXT NOT NULL,
  reserved_usd REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (utc_date, model)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  client_hash TEXT NOT NULL,
  minute_bucket INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (client_hash, minute_bucket)
);
