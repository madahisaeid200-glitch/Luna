-- LUNA Instagram integration: initial private D1 schema.
-- Design artifact only. Do NOT apply to production until the D1 binding,
-- key management, and OAuth implementation have been reviewed and approved.
--
-- Store only SHA-256(state) in this table. Never persist the raw OAuth state.
-- identity_digest is HMAC-SHA-256 of the verified Access identity, keyed by a
-- dedicated Worker secret; it is not a plain hash of the administrator email.
CREATE TABLE IF NOT EXISTS instagram_oauth_states (
  state_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(state_hash) = 64 AND state_hash NOT GLOB '*[^0-9a-f]*'),
  purpose TEXT NOT NULL DEFAULT 'instagram_login'
    CHECK (purpose IN ('instagram_login')),
  identity_digest TEXT NOT NULL
    CHECK (length(identity_digest) = 64 AND identity_digest NOT GLOB '*[^0-9a-f]*'),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_instagram_oauth_states_expiry
  ON instagram_oauth_states(expires_at);

-- One row per connected professional Instagram account.
-- access_token is AES-256-GCM ciphertext only; never store plaintext tokens.
-- The 12-byte IV must be unique for every encryption under the same key.
CREATE TABLE IF NOT EXISTS instagram_connections (
  instagram_user_id TEXT PRIMARY KEY NOT NULL,
  account_type TEXT NOT NULL
    CHECK (account_type IN ('BUSINESS', 'CREATOR')),
  token_ciphertext BLOB NOT NULL,
  token_iv BLOB NOT NULL CHECK (length(token_iv) = 12),
  encryption_key_version INTEGER NOT NULL CHECK (encryption_key_version > 0),
  granted_scopes_json TEXT NOT NULL
    CHECK (json_valid(granted_scopes_json) AND json_type(granted_scopes_json) = 'array'),
  token_expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'reconnect_required', 'disconnected')),
  connected_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_refresh_at INTEGER,
  last_error_code TEXT
    CHECK (last_error_code IS NULL OR length(last_error_code) <= 80),
  CHECK (token_expires_at > connected_at)
);

CREATE INDEX IF NOT EXISTS idx_instagram_connections_status_expiry
  ON instagram_connections(status, token_expires_at);

-- OAuth callback: atomically consume the one-time state before exchanging the
-- authorization code. Bind the expiry parameter to current Unix seconds.
-- A missing returned row means invalid, expired, or already-used state.
--
-- DELETE FROM instagram_oauth_states
-- WHERE state_hash = ?1 AND identity_digest = ?2 AND expires_at > ?3
-- RETURNING purpose, created_at, expires_at;

-- Expired-state cleanup (run opportunistically; no scheduler required):
-- DELETE FROM instagram_oauth_states WHERE expires_at <= ?1;

-- Disconnect: remove credentials rather than retaining an inactive token:
-- DELETE FROM instagram_connections WHERE instagram_user_id = ?1;
