const ALLOWED_ORIGIN = "https://madahisaeid200-glitch.github.io";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const json = (data, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" }
    });
    if (origin !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed." }, 403);
    if (request.method !== "POST") return json({ error: "Use POST." }, 405);
    if (!env.OPENAI_API_KEY) return json({ error: "Server is missing the OPENAI_API_KEY secret." }, 500);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
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
    try {
      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: env.OPENAI_MODEL || "gpt-4.1-mini", input: prompt, max_output_tokens: 2200 })
      });
      const data = await upstream.json();
      if (!upstream.ok) return json({ error: data?.error?.message || "AI provider request failed." }, 502);
      const script = data.output_text || (data.output || []).flatMap(item => item.content || []).map(part => part.text || "").join("\n").trim();
      if (!script) return json({ error: "The AI returned an empty script." }, 502);
      return json({ script, model: env.OPENAI_MODEL || "gpt-4.1-mini" });
    } catch {
      return json({ error: "Could not reach the AI provider. Check Worker logs and network settings." }, 502);
    }
  }
};
