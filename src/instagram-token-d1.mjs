import { decryptInstagramToken, encryptInstagramToken } from "./instagram-token-crypto.mjs";

const ACCOUNT_TYPES = new Set(["BUSINESS", "CREATOR"]);
const MAX_ACCOUNT_ID_LENGTH = 256;

function requireDatabase(db) {
  if (!db || typeof db.prepare !== "function") {
    throw new TypeError("A configured D1 database binding is required");
  }
}

function validateAccountId(value) {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_ACCOUNT_ID_LENGTH) {
    throw new TypeError("instagramUserId must be a non-empty string of at most 256 characters");
  }
}

function validateTimestamp(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(name + " must be a non-negative safe integer");
  }
}

function validateConnection(input) {
  if (!input || typeof input !== "object") throw new TypeError("connection input is required");
  validateAccountId(input.instagramUserId);
  if (!ACCOUNT_TYPES.has(input.accountType)) throw new TypeError("accountType must be BUSINESS or CREATOR");
  if (typeof input.accessToken !== "string" || input.accessToken.length === 0) {
    throw new TypeError("accessToken must be a non-empty string");
  }
  if (!Array.isArray(input.grantedScopes) ||
      input.grantedScopes.some(scope => typeof scope !== "string" || !scope.trim() || scope.length > 128)) {
    throw new TypeError("grantedScopes must be an array of non-empty strings");
  }
  validateTimestamp(input.tokenExpiresAt, "tokenExpiresAt");
  validateTimestamp(input.now, "now");
  if (input.tokenExpiresAt <= input.now) {
    throw new TypeError("tokenExpiresAt must be later than now");
  }
  if (input.lastRefreshAt !== undefined && input.lastRefreshAt !== null) {
    validateTimestamp(input.lastRefreshAt, "lastRefreshAt");
  }
}

function toBytes(value, field) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  throw new TypeError("Stored Instagram " + field + " is not a valid binary value");
}

/**
 * Persist an Instagram professional-account connection in D1.
 * The access token is encrypted before any SQL statement is prepared.
 * The caller must keep this function server-side and pass a decoded 32-byte
 * Worker secret; never call it from browser code or log its input.
 */
export async function putEncryptedInstagramConnection(db, input, keyBytes, keyVersion = 1) {
  requireDatabase(db);
  validateConnection(input);
  const encrypted = await encryptInstagramToken(
    input.accessToken, keyBytes, input.instagramUserId, keyVersion
  );

  const statement = db.prepare(`
    INSERT INTO instagram_connections (
      instagram_user_id, account_type, token_ciphertext, token_iv,
      encryption_key_version, granted_scopes_json, token_expires_at,
      status, connected_at, updated_at, last_refresh_at, last_error_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, NULL)
    ON CONFLICT(instagram_user_id) DO UPDATE SET
      account_type = excluded.account_type,
      token_ciphertext = excluded.token_ciphertext,
      token_iv = excluded.token_iv,
      encryption_key_version = excluded.encryption_key_version,
      granted_scopes_json = excluded.granted_scopes_json,
      token_expires_at = excluded.token_expires_at,
      status = 'active',
      updated_at = excluded.updated_at,
      last_refresh_at = excluded.last_refresh_at,
      last_error_code = NULL
  `).bind(
    input.instagramUserId,
    input.accountType,
    encrypted.ciphertext,
    encrypted.iv,
    encrypted.keyVersion,
    JSON.stringify(input.grantedScopes),
    input.tokenExpiresAt,
    input.now,
    input.now,
    input.lastRefreshAt ?? null
  );

  await statement.run();
  return {
    instagramUserId: input.instagramUserId,
    accountType: input.accountType,
    status: "active",
    tokenExpiresAt: input.tokenExpiresAt,
    encryptionKeyVersion: encrypted.keyVersion
  };
}

/**
 * Load and decrypt a connection for trusted server-side use only.
 * Returns null when the account has no stored connection.
 */
export async function getDecryptedInstagramConnection(db, instagramUserId, keyBytes) {
  requireDatabase(db);
  validateAccountId(instagramUserId);
  const row = await db.prepare(`
    SELECT instagram_user_id, account_type, token_ciphertext, token_iv,
           encryption_key_version, granted_scopes_json, token_expires_at,
           status, connected_at, updated_at, last_refresh_at, last_error_code
    FROM instagram_connections
    WHERE instagram_user_id = ?
    LIMIT 1
  `).bind(instagramUserId).first();

  if (!row) return null;
  if (!ACCOUNT_TYPES.has(row.account_type) || row.status !== "active") {
    throw new TypeError("Stored Instagram connection is not active or has invalid metadata");
  }

  let scopes;
  try {
    scopes = JSON.parse(row.granted_scopes_json);
  } catch {
    throw new TypeError("Stored Instagram scopes metadata is invalid");
  }
  if (!Array.isArray(scopes) || scopes.some(scope => typeof scope !== "string")) {
    throw new TypeError("Stored Instagram scopes metadata is invalid");
  }

  const accessToken = await decryptInstagramToken({
    ciphertext: toBytes(row.token_ciphertext, "ciphertext"),
    iv: toBytes(row.token_iv, "IV"),
    keyVersion: row.encryption_key_version
  }, keyBytes, row.instagram_user_id);

  return {
    instagramUserId: row.instagram_user_id,
    accountType: row.account_type,
    accessToken,
    grantedScopes: scopes,
    tokenExpiresAt: row.token_expires_at,
    encryptionKeyVersion: row.encryption_key_version,
    status: row.status,
    connectedAt: row.connected_at,
    updatedAt: row.updated_at,
    lastRefreshAt: row.last_refresh_at,
    lastErrorCode: row.last_error_code
  };
}

/** Permanently remove a stored connection during disconnect/revocation. */
export async function deleteInstagramConnection(db, instagramUserId) {
  requireDatabase(db);
  validateAccountId(instagramUserId);
  const result = await db.prepare(
    "DELETE FROM instagram_connections WHERE instagram_user_id = ?"
  ).bind(instagramUserId).run();
  return { deleted: Number(result?.meta?.changes ?? 0) > 0 };
}
