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

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body. Send a JSON object with Content-Type: application/json." }, 400); }
    const { title, premise, duration, tone, language, mode, script, characterProfile } = body || {};
    if (mode === "ping") return json({ ok: true, service: "LUNA AI Worker", receivedContentType: request.headers.get("Content-Type") || "", message: "POST and CORS path are working." });
    if (mode === "image_ping") {
      if (typeof body.image !== "string" || !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(body.image)) return json({ ok: false, error: "Image data URL missing or unsupported." }, 400);
      return json({ ok: true, receivedImageChars: body.image.length, mimeType: body.image.slice(5, body.image.indexOf(";")), message: "The full compressed image reached the Worker and was parsed successfully." });
    }
    if (!env.AI) return json({ error: "Workers AI binding is missing. In Cloudflare, add a Workers AI binding named exactly AI, then deploy." }, 503);

    const profile = {
      lunaName: String(characterProfile?.lunaName || "LUNA").trim().slice(0, 40) || "LUNA",
      lunaLook: String(characterProfile?.lunaLook || "Adult elegant European woman with natural realistic features and understated luxury styling.").trim().slice(0, 700),
      lunaPersonality: String(characterProfile?.lunaPersonality || "Confident, warm, witty, romantic and playful.").trim().slice(0, 400),
      leoName: String(characterProfile?.leoName || "LEO").trim().slice(0, 40) || "LEO",
      leoLook: String(characterProfile?.leoLook || "Adult elegant European man with natural realistic features and tailored luxury styling.").trim().slice(0, 700),
      leoPersonality: String(characterProfile?.leoPersonality || "Charming, affectionate, romantic and adorably chaotic.").trim().slice(0, 400),
      style: String(characterProfile?.style || "Photorealistic live-action luxury European fashion editorial, natural cinematic lighting, realistic anatomy.").trim().slice(0, 500)
    };
    const customizeCharacterPrompt = (text) => {
      let result = text.replace(/\bLUNA\b/gi, profile.lunaName).replace(/\bLEO\b/gi, profile.leoName);
      return result + "\n\nCUSTOM CHARACTER CANON — OVERRIDES ANY CONFLICTING DEFAULT CHARACTER DESCRIPTION ABOVE:\n- Main character 1 name must be exactly: " + profile.lunaName + ". Appearance: " + profile.lunaLook + " Personality: " + profile.lunaPersonality + "\n- Main character 2 name must be exactly: " + profile.leoName + ". Appearance: " + profile.leoLook + " Personality: " + profile.leoPersonality + "\n- Shared visual style: " + profile.style + "\n- Use only these two names for the couple. Keep their appearance and personalities consistent in every scene. Do not use the old default names if the user changed them.";
    };

    // A second AI workflow turns a finished episode into a practical video-production pack.
    if (mode === "production") {
      if (typeof script !== "string" || !script.trim()) return json({ error: "Generate or paste an episode script first." }, 400);
      if (script.length > 14000) return json({ error: "The episode script is too long for one production-pack request." }, 400);
      const productionPrompt = `You are the production director for LUNA & LEO, a stylish, funny, romantic virtual couple. Convert the supplied finished screenplay into a practical, low-budget short-video production pack. Do not rewrite the story or add plot events.

CHARACTER CONTINUITY:
- Only LUNA and LEO are visible or speaking unless the source explicitly requires someone else.
- Luna: stylish European luxury look, confident, warm, witty.
- Leo: stylish European luxury look, affectionate, charming, adorably chaotic.
- Keep faces, hair, outfits, body proportions and visual style consistent across every shot.
- Cinematic photorealistic luxury lifestyle, expressive comedy, vertical 9:16 framing for Shorts/Reels.

OUTPUT IN NATURAL ENGLISH ONLY, using these headings:
1. EPISODE SUMMARY (one sentence)
2. CHARACTER CONTINUITY (fixed appearance and wardrobe)
3. SHOT LIST (6–10 shots for a short, or 10–16 for a long episode; each shot has duration, camera/framing, visible action, emotion, and exact dialogue/voiceover if any)
4. IMAGE PROMPTS (one self-contained prompt per shot; describe only what should be visible, include 9:16, photorealistic cinematic lighting, consistent character appearance; no text or logos rendered inside images)
5. VIDEO/MOTION PROMPTS (one short motion prompt per shot: camera movement, facial expression, gestures, natural movement)
6. VOICE AND SOUND (voice direction for Luna and Leo, ambience, sound effects; no copyrighted song requests)
7. ON-SCREEN CAPTIONS (short caption lines in order, suitable for mobile)
8. EDITING PLAN (cuts, pacing, punchline pause, ending tease)
9. FINAL QUALITY CHECK (continuity, no extra characters, no invented props/locations, safe margins for vertical text)

Keep prompts usable with common image/video tools and do not assume a paid provider. Prefer a workflow that can start with still images and simple motion. Preserve every important source event and the ending. Return the production pack only.

FINISHED EPISODE SCRIPT:
${script.trim()}`;
      const customizedProductionPrompt = customizeCharacterPrompt(productionPrompt);
      const primaryModel = env.AI_MODEL || DEFAULT_MODEL;
      const productionModels = primaryModel === FALLBACK_MODEL ? [primaryModel] : [primaryModel, FALLBACK_MODEL];
      const productionFailures = [];
      for (const model of productionModels) {
        try {
          const result = await env.AI.run(model, {
            messages: [
              { role: "system", content: "You are a precise video production planner. Preserve the source story, character continuity and sequence of events." },
              { role: "user", content: customizedProductionPrompt }
            ],
            max_tokens: 2200,
            temperature: 0.35
          });
          const pack = result?.response || result?.result?.response || "";
          if (typeof pack === "string" && pack.trim()) return json({ script: pack.trim(), model, mode: "production", fallbackUsed: model !== primaryModel });
          productionFailures.push(model + ": empty response");
        } catch (error) {
          productionFailures.push(model + ": " + String(error?.message || error || "unknown error").slice(0, 180));
        }
      }
      return json({ error: "AI production-pack generation failed.", details: productionFailures }, 502);
    }

    // Analyze generated images inside LUNA so users do not need to upload every image to chat.
    if (mode === "analyze_image") {
      if (typeof body.image !== "string" || !body.image.startsWith("data:image/") || body.image.length > 7_000_000) {
        return json({ error: "Image data is missing, unsupported, or too large (maximum about 5 MB)." }, 400);
      }
      const analysisPrompt = String(body.prompt || "Describe this image and assess photorealism, anatomy, hands, styling, and visible defects.").slice(0, 1800);
      try {
        // Follow Cloudflare's official Llama Vision tutorial input shape:
        // messages for the question plus the data-URL image in the top-level image field.
        if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(body.image)) {
          return json({ error: "Unsupported image data URL. Use PNG, JPEG, or WebP." }, 400);
        }
        const visionModel = "@cf/meta/llama-4-scout-17b-16e-instruct";
        // Llama 4 Scout expects image input inside the user message content array.
        // The separate top-level "image" field belongs to the older Llama 3.2 Vision API shape.
        const result = await env.AI.run(visionModel, {
          messages: [{
            role: "user",
            content: [
              { type: "text", text: analysisPrompt },
              { type: "image_url", image_url: { url: body.image } }
            ]
          }],
          max_tokens: 450,
          temperature: 0.2
        });
        const analysis = result?.response || result?.description || result?.result?.response || "";
        if (typeof analysis !== "string" || !analysis.trim()) return json({ error: "Vision model returned no analysis." }, 502);
        return json({ analysis: analysis.trim(), model: visionModel, mode: "analyze_image" });
      } catch (error) {
        return json({ error: "AI image analysis failed.", details: String(error?.message || error || "unknown error").slice(0, 300) }, 502);
      }
    }

    // Generate one real scene image with Cloudflare-hosted FLUX.1 schnell.
    if (mode === "image") {
      if (typeof script !== "string" || !script.trim()) return json({ error: "Create the video production pack first." }, 400);
      const prompt = script.trim().slice(0, 2000);
      try {
        const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt, steps: 8 });
        const image = result?.image || result?.result?.image;
        if (typeof image !== "string" || !image) return json({ error: "Image model returned no image data." }, 502);
        return json({ image, mimeType: "image/jpeg", model: "@cf/black-forest-labs/flux-1-schnell", mode: "image" });
      } catch (error) {
        return json({ error: "AI image generation failed.", details: String(error?.message || error || "unknown error").slice(0, 240) }, 502);
      }
    }

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

If language is BOTH, output the English version only. The Worker will translate that English script into Persian separately and append the Persian version.`;

    const customizedPrompt = customizeCharacterPrompt(prompt);
    const primaryModel = env.AI_MODEL || DEFAULT_MODEL;
    const modelsToTry = primaryModel === FALLBACK_MODEL ? [primaryModel] : [primaryModel, FALLBACK_MODEL];
    const failures = [];
    for (const model of modelsToTry) {
      try {
        const result = await env.AI.run(model, {
          messages: [
            { role: "system", content: "You are a disciplined comedy screenwriter. Preserve character names, premise, continuity, language separation, and requested output structure exactly. Never invent a replacement plot." },
            { role: "user", content: customizedPrompt }
          ],
          max_tokens: duration === "long" ? 2200 : 1200,
          temperature: 0.7
        });
        const script = result?.response || result?.result?.response || "";
        if (typeof script === "string" && script.trim()) {
          let finalScript = script.trim();
          let translationModelUsed = null;
          if (language === "both") {
            const translationPrompt = `Translate and adapt the complete screenplay into fluent, idiomatic Iranian Persian as a native comedy screenwriter would write it. Preserve all story events faithfully, but do not translate English sentence structure or idioms word-for-word. Natural spoken Persian is more important than mirroring English grammar.
Rules:
- Preserve every event, joke, character action, object, location, and ending exactly. Do not add or remove plot details.
- Keep character names exactly LUNA and LEO.
- Translate every ordinary English word into Persian; for example, "necklace" must become «گردنبند». Do not leave English nouns or stage-direction phrases in the Persian version.
- Rewrite awkward English-shaped sentences into natural Iranian Persian. For example, prefer «بذار از اول شروع کنیم؛ این بار شام رو فقط برای خودمون رزرو می‌کنم» over «من یک شام جدید را رزرو کنم»، and «تولدم نزدیکه» over «من یک تولد دارم».
- Use warm, informal, believable dialogue for an affectionate couple. Prefer «امیدوارم غافلگیرت کرده باشم» over stiff formal wording such as «امیدوارم بتوانم شما را شگفت زده کنم».
- Make stage directions clear and physically logical; explain who is holding or handing over an object, and do not create contradictory object movements.
- Write all dialogue and production directions in Persian, except the names LUNA and LEO.
- Use only Persian script for headings: عنوان، قلاب، صحنه ۱، صحنه ۲، صحنه ۳، پایان بامزه، پیش‌نمایش قسمت بعد. Never translate PAYOFF as «پرداخت».
- Never output Japanese or Chinese characters, and never leave stray English words such as "joking" in Persian sentences.
- Before returning, silently proofread the Persian for natural phrasing, grammar, missing words, foreign-language fragments, and continuity.
- Preserve the complete ending; do not truncate or stop mid-sentence.
- Return only the Persian script, with no explanation.
\n\nENGLISH SCRIPT TO TRANSLATE:\n${finalScript}`;
            let persian = "";
            const translationModels = ["@cf/zai-org/glm-4.7-flash", FALLBACK_MODEL, model, ...modelsToTry.filter(m => m !== model && m !== FALLBACK_MODEL && m !== "@cf/zai-org/glm-4.7-flash")];
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
                  const cleanedCandidate = candidate.trim();
                  // Reject obvious cross-language corruption and untranslated English words, then try the next model.
                  const hasForeignScript = /[\u0900-\u097F\u3040-\u30FF\u3400-\u9FFF]/u.test(cleanedCandidate);
                  const latinWords = [...cleanedCandidate.matchAll(/\b[A-Za-z]{2,}\b/g)]
                    .map(match => match[0].toUpperCase())
                    .filter(word => word !== "LUNA" && word !== "LEO");
                  if (hasForeignScript || latinWords.length > 0) {
                    failures.push(translationModel + " translation: rejected mixed-language output");
                    continue;
                  }
                  // Catch known high-impact Persian translation failures seen in real tests.
                  const hasObviousPersianErrors = /آپارتمان|دروازه را باز|پارادایس|بوق بوق|سیاه‌چاله|خیس‌خنک|خبط‌گر|اگه می‌خواستی، می‌تونی ازش خوشت بیاد|این زندگی است/u.test(cleanedCandidate);
                  let acceptedCandidate = cleanedCandidate;
                  if (true) { // Always run a source-faithful Persian edit pass; simple keyword checks miss plot drift and awkward dialogue.
                    try {
                      const repairPrompt = `Rewrite and proofread the Persian screenplay below as a native Iranian comedy screenwriter. This is a mandatory quality-control pass, even if no obvious typo is present. Compare the Persian draft against the English source scene by scene and dialogue by dialogue. Restore any source meaning, question, response, joke, action, or event that was changed, omitted, or invented. In particular, never replace a character's question with a different question, and never invent a birthday, reservation, or other event unless it appears in the English source. Correct every awkward phrase, incomplete stage direction, unnatural dialogue tag, and grammar error. Use natural spoken Iranian Persian, not literal translation. Keep the same scene order, all story events, and the complete ending.
Mandatory corrections where relevant: use «سوئیت هتل» rather than «آپارتمان» for a hotel suite; use «در را باز می‌کند» rather than «دروازه را باز می‌کند»; translate "dog's paradise" naturally as «بهشت سگ‌ها»; use «با خجالت» or «با دستپاچگی» for sheepish/nervous, not «با عصبانیت»; translate "goofball" naturally as «شیطون بلا» or «عجب دست‌وپاچلفتی‌ای» depending on context; never use «بوق بوق» for barking, «سیاه‌چاله» for fade to black, or «خیس‌خنک» for whispering. Do not repeat dialogue lines unless the source repeats them. Keep only LUNA and LEO as character names. Preserve all events and the full ending. Output Persian script only, no commentary.
  
PERSIAN DRAFT TO FIX:
${cleanedCandidate}
  
ENGLISH SOURCE SCRIPT (for meaning and continuity):
${finalScript}`;
                      const repaired = await env.AI.run(translationModel, {
                        messages: [
                          { role: "system", content: "You are a meticulous native Iranian Persian screenplay editor. Fix mistranslations and unnatural dialogue while preserving the story." },
                          { role: "user", content: repairPrompt }
                        ],
                        max_tokens: duration === "long" ? 2200 : 1200,
                        temperature: 0.1
                      });
                      const repairedText = repaired?.response || repaired?.result?.response || "";
                      const repairedCandidate = typeof repairedText === "string" ? repairedText.trim() : "";
                      const repairedHasForeignScript = /[\u0900-\u097F\u3040-\u30FF\u3400-\u9FFF]/u.test(repairedCandidate);
                      const repairedLatinWords = [...repairedCandidate.matchAll(/\b[A-Za-z]{2,}\b/g)]
                        .map(match => match[0].toUpperCase())
                        .filter(word => word !== "LUNA" && word !== "LEO");
                      const stillHasObviousErrors = /آپارتمان|دروازه را باز|پارادایس|بوق بوق|سیاه‌چاله|خیس‌خنک|خبط‌گر|اگه می‌خواستی، می‌تونی ازش خوشت بیاد|این زندگی است/u.test(repairedCandidate);
                      if (!repairedCandidate || repairedHasForeignScript || repairedLatinWords.length > 0 || stillHasObviousErrors) {
                        failures.push(translationModel + " translation: rejected low-quality Persian and tried next model");
                        continue;
                      }
                      acceptedCandidate = repairedCandidate;
                    } catch (repairError) {
                      failures.push(translationModel + " Persian repair: " + String(repairError?.message || repairError || "unknown error").slice(0, 140));
                      continue;
                    }
                  }
                  persian = acceptedCandidate;
                  translationModelUsed = translationModel;
                  break;
                }
              } catch (translationError) {
                failures.push(translationModel + " translation: " + String(translationError?.message || translationError || "unknown error").slice(0, 180));
              }
            }
            if (!persian) {
              // Translation failure must not discard a successfully generated English episode.
              failures.push(model + ": Persian translation failed; returning the English script.");
              finalScript += "\n\n══════════ نسخه فارسی ══════════\n\nترجمه فارسی این بار آماده نشد. نسخه انگلیسی بالا تولید شده است؛ لطفاً فقط بخش فارسی را دوباره امتحان کنید.";
              return json({ script: finalScript, model, translationModel: null, translationWarning: true, details: failures.slice(-8), fallbackUsed: model !== primaryModel });
            }
            finalScript += "\n\n══════════ نسخه فارسی ══════════\n\n" + persian;
          }
          return json({ script: finalScript, model, translationModel: language === "both" ? translationModelUsed : null, fallbackUsed: model !== primaryModel });
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
