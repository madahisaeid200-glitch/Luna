const STATE_BYTES = 32;
const STATE_TTL_SECONDS = 10 * 60;
const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const encoder = new TextEncoder();

function requireDatabase(db) {
  if (!db || typeof db.prepare !== "function") {
    throw new TypeError("A configured D1 database binding is required");
  }
}

function validateNow(now) {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new TypeError("now must be a non-negative safe integer");
  }
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  if (typeof value !== "string" || !STATE_PATTERN.test(value)) {
    throw new TypeError("OAuth state must be a 43-character base64url value");
  }
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=";
  let binary;
  try {
    binary = atob(base64);
  } catch {
    throw new TypeError("OAuth state is malformed");
  }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (bytes.byteLength !== STATE_BYTES || bytesToBase64Url(bytes) !== value) {
    throw new TypeError("OAuth state is malformed");
  }
  return bytes;
}

async function hashState(stateBytes) {
  const digest = await crypto.subtle.digest("SHA-256", stateBytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Create a cryptographically random, single-use OAuth state.
 * Only its SHA-256 digest is written to D1; the raw value is returned once
 * for the authorization redirect and must never be logged or persisted.
 */
export async function createInstagramOAuthState(db, now) {
  requireDatabase(db);
  validateNow(now);

  const random = crypto.getRandomValues(new Uint8Array(STATE_BYTES));
  const state = bytesToBase64Url(random);
  const stateHash = await hashState(encoder.encode(state));
  const expiresAt = now + STATE_TTL_SECONDS;

  await db.prepare(`
    INSERT INTO instagram_oauth_states (
      state_hash, purpose, created_at, expires_at
    ) VALUES (?, 'instagram_login', ?, ?)
  `).bind(stateHash, now, expiresAt).run();

  return { state, expiresAt };
}

/**
 * Atomically consume a valid, unexpired OAuth state.
 * D1 DELETE ... RETURNING ensures only one concurrent callback can succeed.
 * Invalid, expired, and already-consumed values all return null.
 */
export async function consumeInstagramOAuthState(db, state, now) {
  requireDatabase(db);
  validateNow(now);
  const stateBytes = base64UrlToBytes(state);
  const stateHash = await hashState(encoder.encode(state));

  const row = await db.prepare(`
    DELETE FROM instagram_oauth_states
    WHERE state_hash = ? AND expires_at > ?
    RETURNING purpose, created_at, expires_at
  `).bind(stateHash, now).first();

  if (!row) return null;
  if (row.purpose !== "instagram_login" ||
      !Number.isSafeInteger(row.created_at) ||
      !Number.isSafeInteger(row.expires_at) ||
      row.expires_at <= now ||
      row.expires_at <= row.created_at ||
      row.expires_at - row.created_at !== STATE_TTL_SECONDS) {
    throw new TypeError("Stored Instagram OAuth state metadata is invalid");
  }

  return {
    purpose: row.purpose,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

/** Opportunistic cleanup; no scheduled trigger is required. */
export async function deleteExpiredInstagramOAuthStates(db, now) {
  requireDatabase(db);
  validateNow(now);
  const result = await db.prepare(
    "DELETE FROM instagram_oauth_states WHERE expires_at <= ?"
  ).bind(now).run();
  return { deleted: Number(result?.meta?.changes ?? 0) };
}
