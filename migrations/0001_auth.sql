-- Students allowed to register (managed with scripts/students.sh)
CREATE TABLE allowed (email TEXT PRIMARY KEY, added_at INTEGER NOT NULL);

CREATE TABLE users (
  email TEXT PRIMARY KEY,
  pw_hash TEXT NOT NULL,           -- base64 PBKDF2-SHA256
  pw_salt TEXT NOT NULL,           -- base64, 16 bytes
  verified INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,       -- consecutive failed logins
  locked_until INTEGER NOT NULL DEFAULT 0, -- ms epoch
  created_at INTEGER NOT NULL
);

-- One-time email links; only the SHA-256 of the token is stored
CREATE TABLE tokens (
  hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('verify', 'reset')),
  expires INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX tokens_email ON tokens (email, kind);

CREATE TABLE sessions (
  hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX sessions_email ON sessions (email);
