const UPSTREAM = "https://orange-firefly-6434.madahisaeid200.workers.dev";
const ALLOWED_ORIGIN = "https://madahisaeid200-glitch.github.io";

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api")) return env.ASSETS.fetch(request);

    const origin = request.headers.get("Origin") || "";
    const headers = cors(origin);
    const json = (data, status = 200) => new Response(JSON.stringify(data), {
      status,
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });

    if (origin && origin !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed." }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "GET" && request.method !== "POST") {
      return json({ error: "Use GET for health check or POST to generate a script." }, 405);
    }

    try {
      const upstreamHeaders = new Headers();
      if (request.method === "POST") upstreamHeaders.set("Content-Type", "application/json");
      const upstream = await fetch(UPSTREAM, {
        method: request.method,
        headers: upstreamHeaders,
        body: request.method === "POST" ? await request.text() : undefined
      });
      const responseHeaders = new Headers(headers);
      responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "application/json; charset=utf-8");
      responseHeaders.set("Cache-Control", "no-store");
      return new Response(await upstream.text(), { status: upstream.status, headers: responseHeaders });
    } catch {
      return json({ error: "LUNA upstream service could not be reached." }, 502);
    }
  }
};
