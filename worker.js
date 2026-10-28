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
      ? "Write the complete script only in idiomatic, conversational Persian as a native Persian comedy screenwriter would write it. Do NOT translate English idioms word-for-word. Dialogue must sound natural when spoken aloud. Do not mix English into Persian except the character names LUNA and LEO. Use these exact Persian headings: عنوان، قلاب، صحنه ۱، صحنه ۲، صحنه ۳، پایان بامزه، پیش‌نمایش قسمت بعد. Never use headings such as پرداخت or پایان‌بندی به‌عنوان ترجمهٔ لفظی PAYOFF. Never output Japanese, Chinese, or other non-Persian scripts. Avoid unnatural phrases like «من را با خوشی جذب کنید»; use natural romantic teasing such as «به‌جای این‌همه برنامه‌ریزی، فقط کافیه دلم رو به دست بیاری» when appropriate."
      : "Write the complete script only in natural English.";
    const toneText = ({
      romcom: "warm romantic comedy, cute chemistry, playful teasing, and an affectionate misunderstanding",
      chaos: "escalating misunderstanding, playful chaos, fast comedic timing, and a satisfying resolution",
      luxury: "stylish luxury travel/fashion setting, elegant visuals, playful comedy, and romantic chemistry"
    })[tone] || "warm romantic comedy";

    const outputFormatText = language === "fa"
      ? "عنوان\nقلاب\nصحنه ۱\nصحنه ۲\nصحنه ۳\nپایان بامزه\nپیش‌نمایش قسمت بعد"
      : "TITLE\nHOOK\nSCENE 1\nSCENE 2\nSCENE 3\nPAYOFF\nNEXT-EPISODE TEASE";

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
- The ending must be complete, not cut off. Include the final dialogue and the next-episode tease; never stop mid-sentence.
- Use plain, consistent headings and character labels. Do not use Japanese/Chinese characters, mixed-language fragments, or corrupted words.
- When writing Persian, write like a native Iranian comedy screenwriter, not a translator. Prefer short, natural spoken lines; avoid stiff literal translations and awkward phrases. Stage directions must also be fluent Persian. Use «پیش‌نمایش قسمت بعد» for the next-episode tease and «پایان بامزه» for the payoff; never use «پرداخت» as a screenplay heading.
- In Persian dialogue, use respectful/intimate pronouns consistently for this loving couple; avoid unnatural formal phrasing unless it is intentionally a joke.
- Keep each scene physically and logically continuous with the previous scene.
- For a 30–60 second Short/Reel, target approximately 120–170 spoken words and keep production directions concise.
- Return only the script. Do not add explanations, apologies, analysis, or meta-commentary.

STYLE: ${toneText}
LENGTH: ${durationText}
LANGUAGE: ${languageText}

EPISODE TITLE: ${title.trim()}
CORE PREMISE: ${premise.trim()}

OUTPUT FORMAT:
${outputFormatText}

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
        if (typeof script === "string" && script.trim()) {
          let finalScript = script.trim();
          if (language === "both") {
            const translationPrompt = `Translate and adapt the complete screenplay into fluent, idiomatic Iranian Persian as a native comedy screenwriter would write it. Preserve all story events faithfully, but do not translate English sentence structure or idioms word-for-word. Natural spoken Persian is more important than mirroring English grammar.
Rules:
- Preserve every event, joke, character action, object, location, and ending exactly. Do not add or remove plot details.
- Keep character names exactly LUNA and LEO.
- Write all dialogue and production directions in Persian, except the names LUNA and LEO.
- Use only Persian script for headings: عنوان، قلاب، صحنه ۱، صحنه ۲، صحنه ۳، پایان بامزه، پیش‌نمایش قسمت بعد. Never translate PAYOFF as «پرداخت».
- Never output Japanese or Chinese characters, and never leave stray English words such as "joking" in Persian sentences.
- Preserve the complete ending; do not truncate or stop mid-sentence.
- Return only the Persian script, with no explanation.
\n\nENGLISH SCRIPT TO TRANSLATE:\n${finalScript}`;
            let persian = "";
            const translationModels = [model, ...modelsToTry.filter(m => m !== model)];
            for (const translationModel of translationModels) {
              try {
                const translated = await env.AI.run(translationModel, {
                  messages: [
                    { role: "system", content: "You are a professional Persian screenplay translator. Produce fluent Persian only and preserve all source events exactly." },
                    { role: "user", content: translationPrompt }
                  ],
                  max_tokens: duration === "long" ? 2200 : 1200,
                  temperature: 0.2
                });
                const candidate = translated?.response || translated?.result?.response || "";
                if (typeof candidate === "string" && candidate.trim()) {
                  persian = candidate.trim();
                  break;
                }
              } catch (translationError) {
                failures.push(translationModel + " translation: " + String(translationError?.message || translationError || "unknown error").slice(0, 180));
              }
            }
            if (!persian) {
              failures.push(model + ": Persian translation failed");
              continue;
            }
            finalScript += "\n\n══════════ نسخه فارسی ══════════\n\n" + persian;
          }
          return json({ script: finalScript, model, fallbackUsed: model !== primaryModel });
        }
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
