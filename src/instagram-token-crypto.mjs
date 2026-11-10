const IV_BYTES = 12;
const KEY_BYTES = 32;
const TAG_BITS = 128;
const encoder = new TextEncoder();

function validateContext(accountId, keyVersion) {
  if (typeof accountId !== "string" || !accountId.trim() || accountId.length > 256) {
    throw new TypeError("accountId must be a non-empty string of at most 256 characters");
  }
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) {
    throw new TypeError("keyVersion must be a positive safe integer");
  }
}

function validateKey(keyBytes) {
  if (!(keyBytes instanceof Uint8Array) || keyBytes.byteLength !== KEY_BYTES) {
    throw new TypeError("Instagram token encryption key must be exactly 32 bytes");
  }
}

function contextData(accountId, keyVersion) {
  return encoder.encode("LUNA/instagram-token/v1/" + accountId + "/" + keyVersion);
}

async function importAesKey(keyBytes, usages) {
  validateKey(keyBytes);
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, usages);
}

/**
 * Encrypt an Instagram access token for storage in a private D1 BLOB column.
 * Supply the 32-byte key decoded from the Worker secret; never pass a token
 * or key through browser code or logs. The returned IV is 96-bit random.
 */
export async function encryptInstagramToken(token, keyBytes, accountId, keyVersion) {
  validateContext(accountId, keyVersion);
  if (typeof token !== "string" || token.length === 0) {
    throw new TypeError("token must be a non-empty string");
  }

  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await importAesKey(keyBytes, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: contextData(accountId, keyVersion), tagLength: TAG_BITS },
    key,
    encoder.encode(token)
  );

  return {
    ciphertext: new Uint8Array(encrypted),
    iv,
    keyVersion
  };
}

/**
 * Decrypt a D1 ciphertext only for the account and key version it was bound to.
 * AES-GCM authentication failures are allowed to throw; callers must return a
 * generic sanitized error and must never log the ciphertext, token, or secret.
 */
export async function decryptInstagramToken(record, keyBytes, accountId) {
  if (!record || typeof record !== "object") throw new TypeError("encrypted token record is required");
  validateContext(accountId, record.keyVersion);
  validateKey(keyBytes);
  if (!(record.iv instanceof Uint8Array) || record.iv.byteLength !== IV_BYTES) {
    throw new TypeError("Instagram token IV must be exactly 12 bytes");
  }
  if (!(record.ciphertext instanceof Uint8Array) || record.ciphertext.byteLength < 17) {
    throw new TypeError("Instagram token ciphertext is invalid");
  }

  const key = await importAesKey(keyBytes, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: record.iv,
      additionalData: contextData(accountId, record.keyVersion),
      tagLength: TAG_BITS
    },
    key,
    record.ciphertext
  );
  return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
}
