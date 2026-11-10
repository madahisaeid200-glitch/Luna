import { authorizeInstagramAdmin } from "./instagram-access-auth.mjs";

/**
 * Reserve and protect the Instagram administration namespace without changing
 * the public LUNA health, generation, media, or producer routes.
 * OAuth handlers remain disabled until isolated D1/R2 bindings and secrets exist.
 */
export async function handleInstagramAdminRoute({ request, env, ctx, json }) {
  const rawPathname = new URL(request.url).pathname;
  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(rawPathname);
  } catch {
    if (rawPathname.toLowerCase().startsWith("/api/instagram")) {
      return json({ ok: false, error: "Invalid Instagram administration path." }, 400);
    }
    return null;
  }

  const normalizedCandidate = decodedPathname.toLowerCase();
  const isInstagramNamespace = normalizedCandidate === "/api/instagram" ||
    normalizedCandidate.startsWith("/api/instagram/");
  if (!isInstagramNamespace) return null;

  // Do not let encoded separators, encoded characters, or case variants fall
  // through to the public mode-based Worker dispatcher.
  if (rawPathname !== decodedPathname || rawPathname !== normalizedCandidate) {
    return json({ ok: false, error: "Invalid Instagram administration path." }, 400);
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405);
  }
  const authorization = await authorizeInstagramAdmin(ctx, env);
  if (!authorization.ok) {
    const configurationFailure = authorization.reason === "admin_allowlist_misconfigured" ||
      authorization.reason === "identity_hmac_misconfigured";
    if (configurationFailure) {
      return json({
        ok: false,
        error: "Instagram administration authentication is not configured.",
        code: "INSTAGRAM_AUTH_NOT_CONFIGURED"
      }, 503);
    }
    return json({ ok: false, error: "Instagram administration is not authorized." }, 403);
  }
  return json({
    ok: false,
    error: "Instagram integration is not configured in this environment.",
    code: "INSTAGRAM_NOT_CONFIGURED"
  }, 503);
}
