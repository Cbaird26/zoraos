CREATE TABLE IF NOT EXISTS auth_identities (
  provider TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  linked_by TEXT NOT NULL,
  PRIMARY KEY (provider, subject_hash)
);
