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

    const durationText = duration === "long"
      ? "3–5 minutes. Use 6–8 clearly staged scenes and enough dialogue for the full runtime."
      : "30–60 seconds. Keep it tight enough to fit the runtime, but complete: hook, setup, escalation, payoff, and cliffhanger.";
    const languageText = language === "fa"
      ? "Write the complete script only in natural, fluent Persian. Do not mix English into Persian dialogue except proper names or necessary production terms."
      : language === "both"
        ? "Write the complete script first in natural English. Then provide a complete, faithful Persian version of the SAME story. Do not translate literally or mix the two languages."
        : "Write the complete script only in natural English.";
    const toneText = ({
      romcom: "warm romantic comedy, cute chemistry, playful teasing, and an affectionate misunderstanding",
      chaos: "escalating misunderstanding, playful chaos, fast comedic timing, and a satisfying resolution",
      luxury: "stylish luxury travel/fashion setting, elegant visuals, playful comedy, and romantic chemistry"
    })[tone] || "warm romantic comedy";

    const prompt = `You are the lead writer for the fictional AI influencer couple LUNA and LEO. Create ONE original, production-ready short-form episode.

NON-NEGOTIABLE CHARACTER RULES:
- The two main characters are ONLY LUNA and LEO. Never rename either character. Never use Alex, Luna & Alex, or any other substitute name.
- Luna: stylish, confident, warm, witty, romantic, and playful.
- Leo: charming, affectionate, confident, slightly overconfident, and adorably chaotic.
- They are a loving couple. Humor comes from misunderstandings, timing, and personality differences, never cruelty or humiliation.
- Do not introduce random fantasy creatures, centaurs, tour groups, unrelated characters, or unrelated locations unless the user's premise explicitly requires them.

STORY RULES:
- Follow the user's core premise exactly. Do not replace the central misunderstanding with a different joke or plot.
- Treat every concrete detail in the premise as canon: the planned activity, venue, object, misunderstanding, and reason for the misunderstanding must remain consistent from hook to ending.
- Do not add a bus, bus stop, tour, tourist group, restaurant, second venue, scenic viewpoint, pet, fantasy creature, or any new plot thread unless that exact element is explicitly required by the premise.
- If the premise says the couple is in a five-star hotel suite, keep the episode in that suite; do not move them to a street, restaurant, bus, or tour.
- Only LUNA and LEO may speak or act as characters. Background people may not appear unless the premise explicitly requires them.
- Build the comedy by escalating the specific misunderstanding in the premise, then resolve it clearly with an affectionate punchline. Never invent a different misunderstanding to fill space.
- Before returning the script, silently check: (1) the premise is unchanged, (2) every scene follows from the previous scene, (3) no unrequested venue or characters appear, (4) the ending resolves the main gag and teases a relevant next episode.
- Make the story feel like an episode in an ongoing series about a stylish romantic virtual couple whose luxury plans often go hilariously wrong.
- The first 1–2 seconds must create curiosity.
- Include concise visual/action directions, natural dialogue with clear speaker names, a funny payoff, and a small cliffhanger teasing the next episode.
- The ending must be complete, not cut off.
- For a 30–60 second Short/Reel, target approximately 120–170 spoken words per language version and keep production directions concise.
- Return only the script. Do not add explanations, apologies, analysis, or meta-commentary.

STYLE: ${toneText}
LENGTH: ${durationText}
LANGUAGE: ${languageText}

EPISODE TITLE: ${title.trim()}
CORE PREMISE: ${premise.trim()}

OUTPUT FORMAT:
TITLE
HOOK
SCENE 1
SCENE 2
SCENE 3
PAYOFF
NEXT-EPISODE TEASE

If language is BOTH, repeat the complete structure for the Persian version after the English version. Ensure both versions tell exactly the same story.`;

    const primaryModel = env.AI_MODEL || DEFAULT_MODEL;
    const modelsToTry = primaryModel === FALLBACK_MODEL ? [primaryModel] : [primaryModel, FALLBACK_MODEL];
    const failures = [];
    for (const model of modelsToTry) {
      try {
        const result = await env.AI.run(model, {
          messages: [
            { role: "system", content: "You are a disciplined comedy screenwriter. Preserve character names, premise, continuity, language separation, and requested output structure exactly. Never invent a replacement plot." },
            { role: "user", content: prompt }
          ],
          max_tokens: duration === "long" ? 2200 : 1200,
          temperature: 0.7
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
