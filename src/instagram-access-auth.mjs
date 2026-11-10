const encoder = new TextEncoder();
const EMAIL_PATTERN = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

function parseAllowlist(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const entries = value.split(",");
  const normalized = entries.map(normalizeEmail);
  if (normalized.some(email => !email) || new Set(normalized).size !== normalized.length) {
    return null;
  }
  return new Set(normalized);
}

async function identityDigest(email, secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new TypeError("Instagram identity HMAC secret is not configured securely");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode("LUNA/instagram-access-identity/v1/" + email)
  );
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Authorize an Instagram management request using Cloudflare Access identity.
 * The Access JWT is validated by Cloudflare before ctx.access exposes identity.
 * Never accept identity, email, or authorization claims from request data.
 *
 * Returns a keyed HMAC digest suitable for binding a one-time OAuth state to
 * the initiating administrator. The dedicated HMAC key must be a Worker secret.
 * All errors fail closed.
 */
export async function authorizeInstagramAdmin(ctx, env) {
  try {
    if (!ctx?.access || typeof ctx.access.getIdentity !== "function") {
      return { ok: false, reason: "access_identity_unavailable" };
    }
    const allowlist = parseAllowlist(env?.INSTAGRAM_ADMIN_EMAILS);
    if (!allowlist) return { ok: false, reason: "admin_allowlist_misconfigured" };

    const identity = await ctx.access.getIdentity();
    const email = normalizeEmail(identity?.email);
    if (!email || !allowlist.has(email)) {
      return { ok: false, reason: "admin_identity_not_allowed" };
    }

    const secret = env?.INSTAGRAM_IDENTITY_HMAC_KEY;
    return { ok: true, identityDigest: await identityDigest(email, secret) };
  } catch {
    return { ok: false, reason: "access_identity_unavailable" };
  }
}
