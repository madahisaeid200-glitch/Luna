const ALLOWED_ORIGIN = "https://madahisaeid200-glitch.github.io";
const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const FALLBACK_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = !origin || origin === ALLOWED_ORIGIN;
    const cors = {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };
    const json = (data, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });

    if (request.method === "OPTIONS") {
      if (!allowedOrigin) return json({ error: "Origin not allowed." }, 403);
      return new Response(null, { status: 204, headers: cors });
    }
    if (!allowedOrigin) return json({ error: "Origin not allowed." }, 403);

    // A lightweight endpoint check; it does not spend AI tokens.
    if (request.method === "GET") {
      return json({
        ok: true,
        service: "LUNA AI Worker",
        aiBinding: Boolean(env.AI),
        model: env.AI_MODEL || DEFAULT_MODEL,
        fallbackModel: FALLBACK_MODEL,
        message: env.AI ? "Worker is reachable and the AI binding exists." : "Worker is reachable, but the AI binding named AI is missing."
      }, env.AI ? 200 : 503);
    }
    if (request.method !== "POST") return json({ error: "Use GET for health check or POST to generate a script." }, 405);
    if (!env.AI) return json({ error: "Workers AI binding is missing. In Cloudflare, add a Workers AI binding named exactly AI, then deploy." }, 503);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body. Send a JSON object with Content-Type: application/json." }, 400); }
    const { title, premise, duration, tone, language } = body || {};
    if (![title, premise].every(v => typeof v === "string" && v.trim())) return json({ error: "Please provide a title and premise." }, 400);
    if (title.length > 240 || premise.length > 3000) return json({ error: "Title or premise is too long." }, 400);

    const durationText = duration === "long" ? "3–5 minutes, with 6–8 clearly staged scenes" : "30–60 seconds, optimized for Shorts/Reels";
    const languageText = language === "fa" ? "Write entirely in natural Persian." : language === "both" ? "Write the complete script first in English, then provide a faithful, natural Persian version." : "Write entirely in natural English.";
    const toneText = ({ romcom: "warm romantic comedy and affectionate banter", chaos: "escalating misunderstandings and playful chaos", luxury: "luxury travel and fashion comedy" })[tone] || "warm romantic comedy";
    const prompt = `Create an original, production-ready episode script for the fictional AI influencer couple LUNA and LEO.
Characters: Luna is stylish, confident, warm, and witty. Leo is charming, affectionate, overconfident, and adorably chaotic. Their relationship is loving; humor should come from misunderstandings, timing, and their different personalities, never cruelty.
Style: ${toneText}. Length: ${durationText}. ${languageText}
Episode title: ${title.trim()}
Core premise: ${premise.trim()}
Structure: 1) hook in the first 1–2 seconds, 2) scene-by-scene action, 3) natural dialogue with speaker names, 4) visual/comedic beats, 5) a clear funny payoff, 6) a small cliffhanger teasing the next episode, 7) concise production notes for vertical video and captions.
Avoid generic filler and repeated stock jokes. Make the plot coherent and easy to produce. Clearly label scenes and speakers. Return only the script, no commentary.`;

    const primaryModel = env.AI_MODEL || DEFAULT_MODEL;
    const modelsToTry = primaryModel === FALLBACK_MODEL ? [primaryModel] : [primaryModel, FALLBACK_MODEL];
    const failures = [];
    for (const model of modelsToTry) {
      try {
        const result = await env.AI.run(model, {
          messages: [
            { role: "system", content: "You are an expert comedy screenwriter for short-form vertical videos. Follow the user's language and structure requirements exactly." },
            { role: "user", content: prompt }
          ],
          max_tokens: duration === "long" ? 1800 : 900,
          temperature: 0.8
        });
        const script = result?.response || result?.result?.response || "";
        if (typeof script === "string" && script.trim()) return json({ script: script.trim(), model, fallbackUsed: model !== primaryModel });
        failures.push(model + ": model returned an empty response");
      } catch (error) {
        failures.push(model + ": " + String(error?.message || error || "unknown error").slice(0, 220));
      }
    }
    return json({
      error: "AI generation failed on all configured models.",
      details: failures,
      checks: ["Confirm Workers AI is enabled for this account.", "Check Workers AI usage/quota.", "Review the Worker logs in Cloudflare.", "If needed, set AI_MODEL to an active text-generation model ID."]
    }, 502);
  }
};
