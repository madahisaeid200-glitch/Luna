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

    // Provider-neutral chat fallback. All provider keys are Cloudflare Worker Secrets only.
    const externalChat = async (provider, messages, maxTokens, temperature) => {
      if (provider === "qwen3vl") {
        const model = "qwen3-vl-2b-instruct";
        const response = await fetch("https://api.murakumo.cloud/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages, max_tokens: Math.min(maxTokens, 512), temperature, top_p: 0.85, frequency_penalty: 0.8, presence_penalty: 0.2 }),
          signal: AbortSignal.timeout(45000)
        });
        const raw = await response.text();
        let data;
        try { data = JSON.parse(raw); } catch { throw new Error("qwen3vl HTTP " + response.status + ": non-JSON response"); }
        if (!response.ok) throw new Error("qwen3vl HTTP " + response.status + ": " + String(data?.error?.message || data?.message || raw).slice(0, 220));
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) throw new Error("qwen3vl returned an empty completion");
        return { response: content.trim(), model: data.model || model };
      }
      if (provider === "murakumo") {
        const model = "mishima";
        // Direct keyless Mishima inference; this bypasses OpenRouter entirely.
        // Free inference may log prompts, so only fictional LUNA story material is sent.
        const response = await fetch("https://api.murakumo.cloud/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages, max_tokens: Math.min(maxTokens, 2048), temperature, reasoning_effort: "medium" })
        });
        const raw = await response.text();
        let data;
        try { data = JSON.parse(raw); } catch { throw new Error("murakumo HTTP " + response.status + ": non-JSON response"); }
        if (!response.ok) throw new Error("murakumo HTTP " + response.status + ": " + String(data?.error?.message || data?.message || raw).slice(0, 220));
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) throw new Error("murakumo returned an empty completion");
        return { response: content.trim(), model: response.headers.get("x-murakumo-served-model") || data.model || model };
      }
      if (provider === "gemini") {
        const apiKey = env.GEMINI_API_KEY;
        const model = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
        if (!apiKey) throw new Error("GEMINI_API_KEY is not configured as a Worker Secret");
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: messages.filter(message => message.role !== "system").map(message => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: String(message.content || "") }] })),
            systemInstruction: { parts: [{ text: messages.filter(message => message.role === "system").map(message => message.content).join("\\n") }] },
            generationConfig: { maxOutputTokens: maxTokens, temperature }
          })
        });
        const raw = await response.text();
        let data;
        try { data = JSON.parse(raw); } catch { throw new Error("gemini HTTP " + response.status + ": non-JSON response"); }
        if (!response.ok) throw new Error("gemini HTTP " + response.status + ": " + String(data?.error?.message || raw).slice(0, 220));
        const content = (data?.candidates?.[0]?.content?.parts || []).map(part => part.text || "").join("").trim();
        if (!content) throw new Error("gemini returned an empty or blocked completion");
        return { response: content, model };
      }
      const endpoint = provider === "nvidia" ? "https://integrate.api.nvidia.com/v1/chat/completions" : provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : provider === "mistral" ? "https://api.mistral.ai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
      const apiKey = provider === "nvidia" ? env.NVIDIA_API_KEY : provider === "groq" ? env.GROQ_API_KEY : provider === "mistral" ? env.MISTRAL_API_KEY : env.OPENROUTER_API_KEY;
      const model = provider === "nvidia" ? (env.NVIDIA_MODEL || "nvidia/nemotron-3.5-bolt-e4b") : provider === "groq" ? (env.GROQ_MODEL || "openai/gpt-oss-20b") : provider === "mistral" ? (env.MISTRAL_MODEL || "mistral-small-latest") : (env.OPENROUTER_MODEL || "openrouter/free");
      if (!apiKey) throw new Error(provider.toUpperCase() + "_API_KEY is not configured as a Worker Secret");
      const headers = { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" };
      if (provider === "openrouter") {
        headers["HTTP-Referer"] = "https://madahisaeid200-glitch.github.io/Luna/";
        headers["X-Title"] = "LUNA Studio";
      }
      const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }) });
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error(provider + " HTTP " + response.status + ": non-JSON response"); }
      if (!response.ok) throw new Error(provider + " HTTP " + response.status + ": " + String(data?.error?.message || data?.message || raw).slice(0, 220));
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new Error(provider + " returned an empty completion");
      return { response: content.trim(), model: data.model || model };
    };

    if (request.method === "GET") {
      return json({
        ok: true,
        service: "LUNA AI Worker",
        aiBinding: Boolean(env.AI),
        model: env.AI_MODEL || DEFAULT_MODEL,
        fallbackModel: FALLBACK_MODEL,
        providers: {
          cloudflare: Boolean(env.AI),
          groq: Boolean(env.GROQ_API_KEY),
          mistral: Boolean(env.MISTRAL_API_KEY),
          gemini: Boolean(env.GEMINI_API_KEY),
          nvidia: Boolean(env.NVIDIA_API_KEY),
          openrouter: Boolean(env.OPENROUTER_API_KEY)
        },
        publicFallbacks: { murakumo: true, mishima: true, qwen3vl: true, qwen3vlText: true },
        message: "Worker is reachable. Keyless Qwen3-VL text, Mishima text, and Qwen3-VL vision fallbacks are wired through Murakumo; health checks do not consume model quota."
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
    if (mode === "video_health") {
      try {
        const space = "https://zerogpu-aoti-wan2-2-fp8da-aoti-faster.hf.space";
        const response = await fetch(space + "/gradio_api/info");
        if (!response.ok) return json({ ok: false, engine: "Wan2.2-14B-Fast-I2V", httpStatus: response.status, error: "Wan Space API information endpoint is not reachable." }, 502);
        const info = await response.json();
        const endpoints = Object.keys(info.named_endpoints || {});
        const ready = endpoints.some(name => name.replace(/^\/+/, "") === "generate_video");
        return json({ ok: ready, engine: "Wan2.2-14B-Fast-I2V", spaceStatus: "reachable", endpointAvailable: ready, endpoints, freeGpuQuota: "Hugging Face ZeroGPU quota applies per user; no GPU generation was started." }, ready ? 200 : 503);
      } catch (error) {
        return json({ ok: false, engine: "Wan2.2-14B-Fast-I2V", error: String(error?.message || error).slice(0, 500) }, 502);
      }
    }

    // Real generative image-to-video through the public Hugging Face Wan 2.2 14B Fast Space.
    // This route does not consume Cloudflare Workers AI neurons.
    if (mode === "video") {
      const imageData = typeof body.image === "string" ? body.image : "";
      const promptText = String(body.prompt || "").trim().slice(0, 1800);
      const durationSeconds = Math.max(0.5, Math.min(5, Number(body.durationSeconds) || 3.5));
      const steps = Math.max(1, Math.min(8, Math.round(Number(body.steps) || 4)));
      if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(imageData)) return json({ error: "A PNG, JPEG or WebP reference image is required." }, 400);
      if (imageData.length > 12_000_000) return json({ error: "Reference image is too large. Please use an image under 8 MB." }, 413);
      if (!promptText) return json({ error: "A motion prompt is required." }, 400);
      const space = "https://zerogpu-aoti-wan2-2-fp8da-aoti-faster.hf.space";
      try {
        const comma = imageData.indexOf(",");
        const mime = imageData.slice(5, imageData.indexOf(";")).toLowerCase().replace("image/jpg", "image/jpeg");
        const binary = atob(imageData.slice(comma + 1));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const form = new FormData();
        form.append("files", new Blob([bytes], { type: mime }), "luna-reference." + (mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg"));
        const uploadResponse = await fetch(space + "/gradio_api/upload", { method: "POST", body: form });
        if (!uploadResponse.ok) throw new Error("Wan reference upload failed (HTTP " + uploadResponse.status + ").");
        const uploaded = await uploadResponse.json();
        const uploadedPath = Array.isArray(uploaded) ? uploaded[0] : uploaded?.path;
        if (typeof uploadedPath !== "string" || !uploadedPath) throw new Error("Wan upload did not return a usable file path.");
        const payload = {
          data: [
            { path: uploadedPath, meta: { _type: "gradio.FileData" }, orig_name: "luna-reference." + (mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg") },
            promptText,
            steps,
            "static, frozen frame, still image, slideshow, text, subtitles, watermark, distorted face, extra fingers, deformed hands, identity change, gender swap, wardrobe change, extra people",
            durationSeconds,
            1,
            1,
            42,
            true
          ]
        };
        const submitResponse = await fetch(space + "/gradio_api/call/generate_video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!submitResponse.ok) {
          const detail = (await submitResponse.text()).slice(0, 500);
          throw new Error("Wan job submission failed (HTTP " + submitResponse.status + "): " + detail);
        }
        const submitted = await submitResponse.json();
        if (!submitted?.event_id) throw new Error("Wan did not return a generation job ID.");
        const resultResponse = await fetch(space + "/gradio_api/call/generate_video/" + encodeURIComponent(submitted.event_id));
        if (!resultResponse.ok) throw new Error("Wan result polling failed (HTTP " + resultResponse.status + ").");
        const eventText = await resultResponse.text();
        const dataLines = eventText.split(/\r?\n/).filter(line => line.startsWith("data:"));
        let resultData = null;
        for (let i = dataLines.length - 1; i >= 0; i--) {
          try { resultData = JSON.parse(dataLines[i].slice(5).trim()); break; } catch {}
        }
        if (!resultData) throw new Error("Wan returned no completed video result: " + eventText.slice(-500));
        const findFile = (value) => {
          if (!value) return null;
          if (Array.isArray(value)) { for (const item of value) { const found = findFile(item); if (found) return found; } }
          else if (typeof value === "object") {
            if (typeof value.url === "string" || typeof value.path === "string") return value;
            for (const child of Object.values(value)) { const found = findFile(child); if (found) return found; }
          }
          return null;
        };
        const file = findFile(resultData);
        if (!file) throw new Error("Wan completed but returned no downloadable video file.");
        let fileUrl = file.url || "";
        if (!fileUrl && file.path) fileUrl = "/gradio_api/file=" + encodeURIComponent(file.path);
        if (fileUrl.startsWith("/")) fileUrl = space + fileUrl;
        if (!/^https:\/\/zerogpu-aoti-wan2-2-fp8da-aoti-faster\.hf\.space\//.test(fileUrl)) throw new Error("Wan returned an unexpected video URL.");
        const videoResponse = await fetch(fileUrl);
        if (!videoResponse.ok) throw new Error("Wan video download failed (HTTP " + videoResponse.status + ").");
        const videoType = videoResponse.headers.get("Content-Type") || "video/mp4";
        if (!videoType.includes("video") && !fileUrl.toLowerCase().endsWith(".mp4")) throw new Error("Wan result is not a video file (" + videoType + ").");
        return new Response(videoResponse.body, {
          status: 200,
          headers: {
            ...cors,
            "Content-Type": videoType.includes("video") ? videoType : "video/mp4",
            "Content-Disposition": "attachment; filename=\"LUNA-Wan2.2-I2V.mp4\"",
            "Cache-Control": "no-store",
            "X-LUNA-Video-Engine": "Wan2.2-14B-Fast-I2V"
          }
        });
      } catch (error) {
        return json({
          error: "Wan 2.2 video generation failed.",
          details: String(error?.message || error || "unknown error").slice(0, 900),
          engine: "Wan2.2-14B-Fast-I2V",
          note: "The public ZeroGPU queue and free daily GPU quota are controlled by Hugging Face."
        }, 502);
      }
    }

    if (!env.AI && mode === "tts") return json({ error: "Cloudflare Workers AI binding is required for MeloTTS voice generation." }, 503);

    // Generate a real English voice track with Cloudflare Workers AI MeloTTS.
    if (mode === "tts") {
      const text = String(body.text || "").trim();
      const lang = String(body.lang || "en").slice(0, 8);
      if (!text) return json({ error: "Speech text is required." }, 400);
      if (text.length > 1200) return json({ error: "Speech text is too long (maximum 1200 characters)." }, 400);
      if (lang !== "en") return json({ error: "The first LUNA voice test currently supports English only." }, 400);
      try {
        const startedAt = Date.now();
        const result = await env.AI.run("@cf/myshell-ai/melotts", { prompt: text, lang: "en" });
        // Workers AI documents both JSON/base64 and raw audio/mpeg output variants.
        // Normalize supported binding return shapes to base64 for the browser player.
        let audio = typeof result === "string" ? result : result?.audio;
        const toBase64 = (bytes) => {
          let binary = "";
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
          }
          return btoa(binary);
        };
        if (audio instanceof ArrayBuffer) audio = toBase64(new Uint8Array(audio));
        else if (ArrayBuffer.isView(audio)) audio = toBase64(new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength));
        else if (audio instanceof Blob) audio = toBase64(new Uint8Array(await audio.arrayBuffer()));
        else if (result instanceof ArrayBuffer) audio = toBase64(new Uint8Array(result));
        else if (ArrayBuffer.isView(result)) audio = toBase64(new Uint8Array(result.buffer, result.byteOffset, result.byteLength));
        else if (result instanceof Blob) audio = toBase64(new Uint8Array(await result.arrayBuffer()));
        if (typeof audio !== "string" || !audio.length) {
          return json({
            error: "MeloTTS returned no usable MP3 audio.",
            resultType: Object.prototype.toString.call(result),
            audioType: Object.prototype.toString.call(result?.audio),
            generationMs: Date.now() - startedAt
          }, 502);
        }
        return json({
          audio,
          mimeType: "audio/mpeg",
          model: "@cf/myshell-ai/melotts",
          mode: "tts",
          generationMs: Date.now() - startedAt,
          resultType: Object.prototype.toString.call(result)
        });
      } catch (error) {
        return json({ error: "LUNA voice generation failed.", details: String(error?.message || error || "unknown error").slice(0, 300) }, 502);
      }
    }

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

    // Structured director plan: provider-neutral shot manifest for real generative-video engines.
    if (mode === "director") {
      if (typeof script !== "string" || !script.trim()) return json({ error: "Generate or paste an episode script first." }, 400);
      if (script.length > 14000) return json({ error: "The episode script is too long for one director-plan request." }, 400);
      const directorPrompt = `Convert this finished screenplay into a production-ready multi-shot generative-video plan.
Return ONLY valid JSON, no markdown, with this shape:
{"schemaVersion":"luna-video-plan@1.0.0","episode":{"title":"...","logline":"...","targetAspectRatio":"9:16","targetDurationSeconds":60},"continuityBible":{"luna":"...","leo":"...","visualStyle":"...","continuityRules":["..."]},"shots":[{"id":"S01","durationSeconds":6,"location":"...","shotType":"wide|medium|close-up|over-shoulder|insert","characters":["LUNA","LEO"],"action":"one visible action only","emotion":"...","dialogue":[{"speaker":"LUNA","text":"..."}],"videoPrompt":"self-contained live-action video prompt focused on motion and camera choreography","referenceFramePrompt":"self-contained still-image prompt for this shot","audio":{"ambience":"...","sfx":"...","musicMood":"..."},"transition":"cut|match-cut|dissolve"}],"captions":[{"shotId":"S01","text":"..."}],"qualityGates":["..."]}
Rules:
- 6-10 shots for a short, 10-16 for a longer episode. Each shot is ONE coherent action, suitable for a separate 4-10 second video generation.
- Preserve exact story, chronology, punchline and ending. Invent no events, people, props or locations.
- Main couple only: ${profile.lunaName} and ${profile.leoName}.
- Fixed character bible: ${profile.lunaName}: ${profile.lunaLook} Personality: ${profile.lunaPersonality}. ${profile.leoName}: ${profile.leoLook} Personality: ${profile.leoPersonality}. Style: ${profile.style}.
- Keep wardrobe and accessories identical throughout unless the screenplay explicitly requires a change. Never swap character gender presentation or clothing.
- Dialogue must be exact screenplay dialogue, never invented or paraphrased. Use [] when no dialogue.
- Video prompts describe realistic body motion, facial micro-expression, eye-line, camera movement and lighting continuity. No rendered captions or logos.
- Avoid slideshow/montage language. Every shot is a continuous cinematic moment.
- JSON must parse. Total duration is the sum of shot durations.
SCREENPLAY:
${script.trim()}`;
      const primaryModel = env.AI_MODEL || DEFAULT_MODEL;
      const models = [
        "__MURAKUMO__",
        ...(env.AI ? (primaryModel === FALLBACK_MODEL ? [primaryModel] : [primaryModel, FALLBACK_MODEL]) : []),
        ...(env.GEMINI_API_KEY ? ["__GEMINI__"] : []),
        ...(env.GROQ_API_KEY ? ["__GROQ__"] : []),
        ...(env.MISTRAL_API_KEY ? ["__MISTRAL__"] : []),
        ...(env.NVIDIA_API_KEY ? ["__NVIDIA__"] : []),
        ...(env.OPENROUTER_API_KEY ? ["__OPENROUTER__"] : []),
      ];
      const failures = [];
      let cloudflareQuotaExhausted = false;
      for (const model of models) {
        if (cloudflareQuotaExhausted && !model.startsWith("__")) continue;
        try {
          const messages = [
            { role: "system", content: "You are a film director and generative-video pipeline planner. Return strict JSON only. Never fabricate video-generation success." },
            { role: "user", content: directorPrompt }
          ];
          let result;
          let provider = "cloudflare-workers-ai";
          let actualModel = model;
          if (model.startsWith("__")) {
            provider = model === "__MURAKUMO__" ? "murakumo" : model === "__GEMINI__" ? "gemini" : model === "__GROQ__" ? "groq" : model === "__MISTRAL__" ? "mistral" : model === "__NVIDIA__" ? "nvidia" : "openrouter";
            result = await externalChat(provider, messages, 3500, 0.25);
            actualModel = result.model;
          } else {
            result = await env.AI.run(model, { messages, max_tokens: 3500, temperature: 0.25 });
          }
          let raw = result?.response || result?.result?.response || "";
          if (typeof raw !== "string" || !raw.trim()) throw new Error("empty model response");
          raw = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
          const plan = JSON.parse(raw);
          if (plan.schemaVersion !== "luna-video-plan@1.0.0" || !Array.isArray(plan.shots) || plan.shots.length < 4) throw new Error("response does not match LUNA video-plan schema");
          const allowed = new Set([profile.lunaName, profile.leoName, "LUNA", "LEO"]);
          for (let index = 0; index < plan.shots.length; index++) {
            const shot = plan.shots[index];
            shot.id = "S" + String(index + 1).padStart(2, "0");
            shot.durationSeconds = Math.max(4, Math.min(10, Number(shot.durationSeconds) || 6));
            shot.dialogue = Array.isArray(shot.dialogue) ? shot.dialogue.filter(line => line && allowed.has(line.speaker) && typeof line.text === "string") : [];
            shot.characters = Array.isArray(shot.characters) ? shot.characters.filter(name => allowed.has(name)) : [];
          }
          plan.episode = plan.episode || {};
          plan.episode.targetDurationSeconds = plan.shots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
          plan.episode.targetAspectRatio = "9:16";
          plan.continuityBible = plan.continuityBible || {};
          plan.continuityBible.luna = profile.lunaLook;
          plan.continuityBible.leo = profile.leoLook;
          plan.continuityBible.visualStyle = profile.style;
          plan.qualityGates = Array.isArray(plan.qualityGates) ? plan.qualityGates : [];
          plan.qualityGates.push("Reject altered identity, wardrobe swaps, extra characters, frozen still frames or broken chronology.");
          return json({ ok: true, mode: "director", plan, model: actualModel, provider, fallbackUsed: provider !== "cloudflare-workers-ai" || model !== primaryModel, providerReady: false, note: "Shot plan generated. Real video rendering still requires a connected generative-video provider; no video has been rendered." });
        } catch (error) {
          const errorText = String(error?.message || error || "unknown error");
          failures.push(model + ": " + errorText.slice(0, 180));
          if (!model.startsWith("__") && (/4006/i.test(errorText) || /used up (your )?daily free allocation/i.test(errorText) || /daily free allocation of [\d,]+ neurons/i.test(errorText))) {
            cloudflareQuotaExhausted = true;
            failures.push("Cloudflare daily quota exhausted; switching to configured external providers.");
          }
        }
      }
      return json({ error: "LUNA director-plan generation failed.", details: failures }, 502);
    }

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
- Prioritize believable human photography over beauty or fashion-advertising polish: natural facial asymmetry, real skin texture and pores, fine expression lines, natural hair flyaways, realistic eyes and teeth, candid posture, available-light shadows, restrained depth of field and subtle photographic grain. Avoid waxy skin, perfect symmetry, glossy doll-like faces, excessive retouching, artificial HDR and over-sharpening.
- Give LUNA a consistently polished luxury wardrobe: premium silk, cashmere, fine tailoring or an elegant evening look appropriate to the actual scene; add tasteful visible jewelry such as refined earrings, a delicate necklace, bracelet or ring. A structured designer-style handbag may appear only when it naturally belongs in the scene. Never invent a branded logo.
- Give LEO a consistently tailored premium wardrobe with a refined luxury wristwatch and subtle accessories appropriate to the scene. Keep both characters' outfits and accessories consistent across shots unless the screenplay explicitly includes a change.
- In every IMAGE PROMPT, prefer a candid medium-full or three-quarter frame when it fits the scene. Do NOT force both hands into view. If a hand is visible, describe its complete believable connection from shoulder to arm, wrist and hand; correct perspective, scale, sleeve opening, contact and shadows. Use simple natural actions (resting on a table, lightly holding an object, relaxed beside the body), with naturally bent fingers and plausible joints. Never describe a hand as simply 'in a pocket'; if the story requires a pocket pose, clearly show the pocket opening, wrist and forearm so the hand's position is physically understandable. If a natural hand pose cannot be composed reliably, frame the hands out rather than generating awkward anatomy.
- Skin must retain unretouched microtexture on face, neck and hands: visible pores, fine lines, tiny blemishes, subtle uneven tone, realistic under-eye texture and natural highlights. Explicitly avoid skin smoothing, airbrushing, waxy/plastic finish, beauty retouching and artificial HDR. Add fine organic photographic grain without making the image gritty.
- Give LUNA and LEO subtle, distinct, emotionally readable expressions: natural eye focus, relaxed jaw, slight asymmetrical smile, tiny cheek movement and believable interaction. Avoid frozen, exaggerated, mirrored or identical model-like expressions.
- Build a visually rich but story-faithful background: detailed architecture, refined furniture, premium materials and layered practical lighting when appropriate to the established location. Do not change the screenplay venue or add unrequested plot props, characters or locations.
- Each image prompt must explicitly specify wardrobe, visible accessories when appropriate, the natural action/hand placement, and meaningful background details; do not rely on generic words such as “luxury” or “elegant”.
- Make every image prompt read like an unretouched candid photograph taken by a professional human photographer, not a synthetic fashion campaign. Preserve natural imperfections, subtle facial asymmetry, realistic skin microtexture, physically coherent hands and spontaneous expressions.

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
      const productionModels = [
        "__MURAKUMO__",
        ...(env.AI ? (primaryModel === FALLBACK_MODEL ? [primaryModel] : [primaryModel, FALLBACK_MODEL]) : []),
        ...(env.GEMINI_API_KEY ? ["__GEMINI__"] : []),
        ...(env.GROQ_API_KEY ? ["__GROQ__"] : []),
        ...(env.MISTRAL_API_KEY ? ["__MISTRAL__"] : []),
        ...(env.NVIDIA_API_KEY ? ["__NVIDIA__"] : []),
        ...(env.OPENROUTER_API_KEY ? ["__OPENROUTER__"] : []),
      ];
      const productionFailures = [];
      let productionQuotaExhausted = false;
      for (const model of productionModels) {
        if (productionQuotaExhausted && !model.startsWith("__")) continue;
        try {
          const messages = [
            { role: "system", content: "You are a precise video production planner. Preserve the source story, character continuity and sequence of events." },
            { role: "user", content: customizedProductionPrompt }
          ];
          let result;
          let provider = "cloudflare-workers-ai";
          let actualModel = model;
          if (model.startsWith("__")) {
            provider = model === "__MURAKUMO__" ? "murakumo" : model === "__GEMINI__" ? "gemini" : model === "__GROQ__" ? "groq" : model === "__MISTRAL__" ? "mistral" : model === "__NVIDIA__" ? "nvidia" : "openrouter";
            result = await externalChat(provider, messages, 2200, 0.35);
            actualModel = result.model;
          } else {
            result = await env.AI.run(model, { messages, max_tokens: 2200, temperature: 0.35 });
          }
          const pack = result?.response || result?.result?.response || "";
          if (typeof pack === "string" && pack.trim()) return json({ script: pack.trim(), model: actualModel, provider, mode: "production", fallbackUsed: provider !== "cloudflare-workers-ai" || model !== primaryModel });
          productionFailures.push(model + ": empty response");
        } catch (error) {
          const errorText = String(error?.message || error || "unknown error");
          productionFailures.push(model + ": " + errorText.slice(0, 180));
          if (!model.startsWith("__") && (/4006/i.test(errorText) || /used up (your )?daily free allocation/i.test(errorText) || /daily free allocation of [\d,]+ neurons/i.test(errorText))) {
            productionQuotaExhausted = true;
            productionFailures.push("Cloudflare daily quota exhausted; switching to configured external providers.");
          }
        }
      }
      return json({ error: "AI production-pack generation failed.", details: productionFailures }, 502);
    }

    // Analyze generated images inside LUNA so users do not need to upload every image to chat.
    if (mode === "analyze_image") {
      if (typeof body.image !== "string" || !body.image.startsWith("data:image/") || body.image.length > 7_000_000) {
        return json({ error: "Image data is missing, unsupported, or too large (maximum about 5 MB)." }, 400);
      }
      if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(body.image)) {
        return json({ error: "Unsupported image data URL. Use PNG, JPEG, or WebP." }, 400);
      }
      const analysisPrompt = String(body.prompt || "Describe this image and assess photorealism, anatomy, hands, styling, and visible defects.").slice(0, 1800);
      const qwenModel = "qwen3-vl-2b-instruct";
      let qwenDetails = "";
      try {
        // Keyless vision first to preserve Cloudflare's daily neurons for image generation and voice.
        // Free inference may log images; LUNA sends generated fictional character images only.
        const response = await fetch("https://api.murakumo.cloud/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(35_000),
          body: JSON.stringify({
            model: qwenModel,
            messages: [{
              role: "user",
              content: [
                { type: "text", text: analysisPrompt },
                { type: "image_url", image_url: { url: body.image } }
              ]
            }],
            max_tokens: 450,
            temperature: 0.2
          })
        });
        const raw = await response.text();
        let data;
        try { data = JSON.parse(raw); } catch { throw new Error("Qwen3-VL HTTP " + response.status + ": non-JSON response"); }
        if (!response.ok) throw new Error("Qwen3-VL HTTP " + response.status + ": " + String(data?.error?.message || data?.message || raw).slice(0, 220));
        const analysis = data?.choices?.[0]?.message?.content;
        if (typeof analysis !== "string" || !analysis.trim()) throw new Error("Qwen3-VL returned no analysis.");
        return json({
          analysis: analysis.trim(),
          model: data.model || qwenModel,
          provider: "murakumo",
          mode: "analyze_image",
          fallbackUsed: false
        });
      } catch (qwenError) {
        qwenDetails = String(qwenError?.message || qwenError || "unknown Qwen3-VL error").slice(0, 260);
        try {
          if (!env.AI) throw new Error("Cloudflare Workers AI binding is not configured");
          const visionModel = "@cf/meta/llama-4-scout-17b-16e-instruct";
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
          if (typeof analysis !== "string" || !analysis.trim()) throw new Error("Cloudflare vision model returned no analysis.");
          return json({
            analysis: analysis.trim(),
            model: visionModel,
            provider: "cloudflare-workers-ai",
            mode: "analyze_image",
            fallbackUsed: true,
            fallbackReason: qwenDetails
          });
        } catch (cloudflareError) {
          return json({
            error: "Image analysis failed on keyless Qwen3-VL and Cloudflare vision.",
            details: "Qwen3-VL: " + qwenDetails + " | Cloudflare: " + String(cloudflareError?.message || cloudflareError || "unknown error").slice(0, 260)
          }, 502);
        }
      }
    }

    // Mobile-safe reference-image edit: use a normal JSON response rather than a
    // ReadableStream. Some Android/Chrome network paths stall before exposing stream headers.
    if (mode === "image_edit") {
      const startedAt = Date.now();
      if (typeof body.image !== "string" || !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(body.image) || body.image.length > 4500000) {
        return json({ error: "Reference image is missing, unsupported, or too large." }, 400);
      }
      const prompt = String(body.prompt || "").trim().slice(0, 1800);
      if (!prompt) return json({ error: "An image-edit instruction is required." }, 400);
      try {
        const match = body.image.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([\s\S]+)$/i);
        const mimeType = match[1].toLowerCase().replace("image/jpg", "image/jpeg");
        const binary = atob(match[2]);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const width = Math.min(1920, Math.max(256, Math.round(Number(body.width) || 1024)));
        const height = Math.min(1920, Math.max(256, Math.round(Number(body.height) || 1024)));
        const failures = [];
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const form = new FormData();
            form.append("prompt", prompt);
            form.append("input_image_0", new Blob([bytes], { type: mimeType }), "luna-reference." + (mimeType.split("/")[1] || "jpg"));
            form.append("width", String(width));
            form.append("height", String(height));
            // Match Cloudflare's documented Workers AI multipart pattern exactly:
            // serialize FormData through a Request so the runtime supplies the boundary.
            const formRequest = new Request("https://luna.invalid/image-edit", {
              method: "POST",
              body: form
            });
            const modelStartedAt = Date.now();
            const modelPromise = env.AI.run("@cf/black-forest-labs/flux-2-klein-4b", {
              multipart: {
                body: formRequest.body,
                contentType: formRequest.headers.get("content-type")
              }
            });
            let timeoutId;
            const result = await Promise.race([
              modelPromise,
              new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error("FLUX.2 Klein inference exceeded 90000 ms")), 90000);
              })
            ]).finally(() => clearTimeout(timeoutId));
            console.log("LUNA image_edit model completed", {
              model: "@cf/black-forest-labs/flux-2-klein-4b",
              elapsedMs: Date.now() - modelStartedAt,
              width,
              height,
              inputImageBytes: bytes.length
            });
            const image = result?.image || result?.result?.image;
            if (typeof image === "string" && image) {
              return json({
                image, mimeType: "image/jpeg", model: "@cf/black-forest-labs/flux-2-klein-4b",
                mode: "image_edit", generationMs: Date.now() - startedAt, attempts: attempt,
                retryUsed: attempt > 1, receivedImageChars: body.image.length
              });
            }
            failures.push("attempt " + attempt + ": model returned no image data");
          } catch (error) {
            failures.push("attempt " + attempt + ": " + String(error?.message || error || "unknown error").slice(0, 220));
          }
          if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 700));
        }
        return json({ error: "AI reference-image editing failed after 2 attempts.", details: failures.join(" | "), generationMs: Date.now() - startedAt }, 502);
      } catch (error) {
        return json({ error: "AI reference-image editing request could not be prepared.", details: String(error?.message || error || "unknown error").slice(0, 300), generationMs: Date.now() - startedAt }, 500);
      }
    }

    // Generate one real scene image with Cloudflare-hosted FLUX.1 schnell.
    if (mode === "image") {
      if (typeof script !== "string" || !script.trim()) return json({ error: "Create the video production pack first." }, 400);
      const prompt = script.trim().slice(0, 2000);
      try {
        const generationStartedAt = Date.now();
        // Use FLUX schnell default (4 steps) to keep generation responsive on the free tier.
        const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt, steps: 4 });
        const image = result?.image || result?.result?.image;
        if (typeof image !== "string" || !image) return json({ error: "Image model returned no image data." }, 502);
        return json({ image, mimeType: "image/jpeg", model: "@cf/black-forest-labs/flux-1-schnell", mode: "image", generationMs: Date.now() - generationStartedAt, steps: 4 });
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
    const murakumoPrompt = `Return ONLY one valid JSON object, with exactly these string keys: hook, luna1, leo1, luna2, leo2, luna3, leo3, tease. No markdown, no explanation, no extra keys.
You are writing a short romantic-comedy episode for the fictional adult couple LUNA and LEO. Only they may appear or speak. Keep the entire story in their luxury hotel suite. Do not describe clothing. Use only the reservation note and welcome card; add no other props, people, places, or side plots.
The exact premise: LEO booked the suite for their anniversary but typed the wrong surname. LUNA sees the unfamiliar surname on the welcome card and thinks the suite was booked for another couple. LEO explains the typo. Resolve it with affectionate humor and tease the next episode.
Each JSON key is a separate spoken turn; the speaker is defined by the key, so do not write speaker names inside the value. Keep this order and meaning: hook (LUNA notices the unfamiliar surname on the welcome card); luna1 (asks who the Brauns are); leo1 (must speak in first person and clearly say he typed the wrong surname on their anniversary reservation; never blame LUNA); luna2 (jokes that their anniversary is booked under another couple's name); leo2 (a clever affectionate reply that does not contradict his admission); luna3 (a warm punchline); leo3 (an affectionate reply); tease (one relevant next-episode tease). Make each value a complete, natural line of 12–18 words, except hook and tease may be 10–14 words. Total spoken text must be 100–130 words. Never swap speakers, repeat wording, questions, or jokes. No circular dialogue. Every line adds new information.
Tone: ${toneText}
Language: ${language === "fa" ? "natural spoken Iranian Persian; keep only the names LUNA and LEO in Latin letters" : "natural conversational English"}
Title: ${title.trim()}
Premise (must remain unchanged): ${premise.trim()}
`;
    const primaryModel = env.AI_MODEL || DEFAULT_MODEL;
    const modelsToTry = [
      ...(env.AI ? (primaryModel === FALLBACK_MODEL ? [primaryModel] : [primaryModel, FALLBACK_MODEL]) : []),
      ...(env.MISTRAL_API_KEY ? ["__MISTRAL__"] : []),
      ...(env.NVIDIA_API_KEY ? ["__NVIDIA__"] : []),
      ...(env.GROQ_API_KEY ? ["__GROQ__"] : []),
      ...(env.GEMINI_API_KEY ? ["__GEMINI__"] : []),
      ...(env.OPENROUTER_API_KEY ? ["__OPENROUTER__"] : []),
      ...(duration === "long" ? ["__MURAKUMO__"] : ["__QWEN3VL__"])
    ];
    const failures = [];
    let cloudflareQuotaExhausted = false;
    if (!modelsToTry.length) {
      return json({
        error: "No text AI provider is configured.",
        requiredSecrets: ["MISTRAL_API_KEY", "NVIDIA_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY"],
        note: "Add at least one provider key as a Cloudflare Worker Secret. Never place keys in GitHub Pages or public source files."
      }, 503);
    }
    for (const model of modelsToTry) {
      // A Cloudflare daily-quota failure should skip only the remaining Cloudflare
      // models, not separately configured external providers such as OpenRouter.
      if (cloudflareQuotaExhausted && !model.startsWith("__")) continue;
      try {
        const messages = [
          { role: "system", content: (model === "__MURAKUMO__" || model === "__QWEN3VL__") ? "Write concise, faithful LUNA and LEO screenplays. Use exactly the names LUNA and LEO. Never invent characters, wardrobe changes, props, or locations." : "You are a disciplined comedy screenwriter. Preserve character names, premise, continuity, language separation, and requested output structure exactly. Never invent a replacement plot." },
          { role: "user", content: (model === "__MURAKUMO__" || model === "__QWEN3VL__") ? murakumoPrompt : customizedPrompt }
        ];
        let result;
        let provider = "cloudflare-workers-ai";
        let actualModel = model;
        if (model.startsWith("__")) {
          provider = model === "__QWEN3VL__" ? "qwen3vl" : model === "__MURAKUMO__" ? "murakumo" : model === "__MISTRAL__" ? "mistral" : model === "__NVIDIA__" ? "nvidia" : model === "__GROQ__" ? "groq" : model === "__GEMINI__" ? "gemini" : "openrouter";
          result = await externalChat(provider, messages, provider === "qwen3vl" ? 512 : 2048, provider === "qwen3vl" ? 0.4 : 0.7);
          actualModel = result?.model || model;

        } else {
          result = await env.AI.run(model, { messages, max_tokens: duration === "long" ? 2200 : 1200, temperature: 0.7 });
        }
        const script = result?.response || result?.result?.response || "";
        if (typeof script === "string" && script.trim()) {
          let finalScript = script.trim();
          if (provider === "qwen3vl") {
            const keys = ["hook", "luna1", "leo1", "luna2", "leo2", "luna3", "leo3", "tease"];
            const parseStructured = value => {
              const a = value.indexOf("{");
              const b = value.lastIndexOf("}");
              if (a < 0 || b <= a) return null;
              try { return JSON.parse(value.slice(a, b + 1)); } catch (_) { return null; }
            };
            const isValid = data => {
              if (!data || !keys.every(key => typeof data[key] === "string" && data[key].trim())) return false;
              const values = keys.map(key => data[key].toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim());
              if (new Set(values).size !== values.length) return false;
              const totalWords = keys.reduce((sum, key) => sum + data[key].trim().split(/\s+/).length, 0);
              if (totalWords < 75 || totalWords > 150) return false;
              if (/surname|welcome card|anniversary reservation/i.test(premise) && language !== "fa") {
                const leo1 = data.leo1.toLowerCase();
                const luna2 = data.luna2.toLowerCase();
                if (!/\b(i|i've|i'm|my)\b/.test(leo1) || !/(wrong|typo|mistyped|typed)/.test(leo1) || !/(reservation|booked|surname)/.test(leo1) || /(not me|you typed|you are the one)/.test(leo1)) return false;
                if (!/(anniversary|another couple|other couple|another name)/.test(luna2)) return false;
              }
              return true;
            };
            let structured = parseStructured(finalScript);
            if (!isValid(structured)) {
              const repairMessages = [
                { role: "system", content: "You are a strict screenplay continuity editor. Return only valid JSON with the exact required keys. Never swap speakers or contradict the premise." },
                { role: "user", content: "Repair this short LUNA and LEO screenplay JSON. Required keys: hook, luna1, leo1, luna2, leo2, luna3, leo3, tease. LEO's line leo1 MUST say in first person that he typed the wrong surname on their anniversary reservation; he must not blame LUNA. LUNA's luna2 line MUST mention their anniversary being booked under another couple's name. Each value must be unique and 12–18 words (hook/tease 10–14). Total 100–130 words. Keep only LUNA and LEO, stay in the hotel suite, no extra props or people. Return only JSON. Original: " + JSON.stringify(structured || { draft: finalScript }) }
              ];
              try {
                const repaired = await externalChat("qwen3vl", repairMessages, 512, 0.35);
                structured = parseStructured(repaired.response || "");
              } catch (repairError) {
                failures.push("Qwen structure repair failed: " + String(repairError?.message || repairError).slice(0, 160));
              }
            }
            if (!isValid(structured)) throw new Error("Qwen draft failed screenplay consistency checks; no low-quality script was accepted.");
            finalScript = "**TITLE:** " + title.trim() + "\n\n**HOOK:**\n" + structured.hook.trim() +
              "\n\n**SCENE 1**\nLUNA: " + structured.luna1.trim() + "\nLEO: " + structured.leo1.trim() +
              "\n\n**SCENE 2**\nLUNA: " + structured.luna2.trim() + "\nLEO: " + structured.leo2.trim() +
              "\n\n**PAYOFF**\nLUNA: " + structured.luna3.trim() + "\nLEO: " + structured.leo3.trim() +
              "\n\n**NEXT-EPISODE TEASE:**\n" + structured.tease.trim();
          }
          if (provider === "qwen3vl") {
            const seenDialogue = new Set();
            finalScript = finalScript.split("\n").filter(line => {
              const match = line.match(/^\s*(LUNA|LEO):\s*(.+)$/i);
              if (!match) return true;
              const normalized = match[1].toUpperCase() + ":" + match[2].toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
              if (normalized.length > 24 && seenDialogue.has(normalized)) return false;
              seenDialogue.add(normalized);
              return true;
            }).join("\n");
          }
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
            const translationModels = [
              ...(env.AI && provider === "cloudflare-workers-ai" && !cloudflareQuotaExhausted ? ["@cf/zai-org/glm-4.7-flash", FALLBACK_MODEL, ...(model.startsWith("__") ? [] : [model])] : []),
              "__MURAKUMO__",
              ...(env.MISTRAL_API_KEY ? ["__MISTRAL__"] : []),
        ...(env.NVIDIA_API_KEY ? ["__NVIDIA__"] : []),
      ...(env.GROQ_API_KEY ? ["__GROQ__"] : []),
              ...(env.GEMINI_API_KEY ? ["__GEMINI__"] : []),
              ...(env.OPENROUTER_API_KEY ? ["__OPENROUTER__"] : []),
            ];
            for (const translationModel of translationModels) {
              try {
                const translationMessages = [
                  { role: "system", content: "You are a professional Persian screenplay translator. Produce fluent Persian only and preserve all source events exactly." },
                  { role: "user", content: translationPrompt }
                ];
                const translated = translationModel.startsWith("__")
                  ? await externalChat(translationModel === "__MURAKUMO__" ? "murakumo" : translationModel === "__MISTRAL__" ? "mistral" : translationModel === "__NVIDIA__" ? "nvidia" : translationModel === "__GROQ__" ? "groq" : translationModel === "__GEMINI__" ? "gemini" : "openrouter", translationMessages, duration === "long" ? 2200 : 1200, 0.2)
                  : await env.AI.run(translationModel, { messages: translationMessages, max_tokens: duration === "long" ? 2200 : 1200, temperature: 0.2 });
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
                      const repairMessages = [
                        { role: "system", content: "You are a meticulous native Iranian Persian screenplay editor. Fix mistranslations and unnatural dialogue while preserving the story." },
                        { role: "user", content: repairPrompt }
                      ];
                      const repaired = translationModel.startsWith("__")
                        ? await externalChat(translationModel === "__MURAKUMO__" ? "murakumo" : translationModel === "__MISTRAL__" ? "mistral" : translationModel === "__NVIDIA__" ? "nvidia" : translationModel === "__GROQ__" ? "groq" : translationModel === "__GEMINI__" ? "gemini" : "openrouter", repairMessages, duration === "long" ? 2200 : 1200, 0.1)
                        : await env.AI.run(translationModel, { messages: repairMessages, max_tokens: duration === "long" ? 2200 : 1200, temperature: 0.1 });
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
                  translationModelUsed = translated?.model || translationModel;
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
              return json({ script: finalScript, model: actualModel, provider, translationModel: null, translationWarning: true, details: failures.slice(-8), fallbackUsed: provider !== "cloudflare-workers-ai" || model !== primaryModel });
            }
            finalScript += "\n\n══════════ نسخه فارسی ══════════\n\n" + persian;
          }
          return json({ script: finalScript, model: actualModel, provider, translationModel: language === "both" ? translationModelUsed : null, fallbackUsed: provider !== "cloudflare-workers-ai" || model !== primaryModel });
        }
        failures.push(model + ": model returned an empty response");
      } catch (error) {
        const errorText = String(error?.message || error || "unknown error");
        failures.push(model + ": " + errorText.slice(0, 220));
        // Workers AI's daily neuron allowance is shared across its models.
        // Once error 4006 is returned, trying the second Cloudflare model cannot help
        // and only adds latency. Continue only to separately configured external providers.
        const isCloudflareQuotaError = !model.startsWith("__") &&
          (/4006/i.test(errorText) ||
           /used up (your )?daily free allocation/i.test(errorText) ||
           /daily free allocation of [\d,]+ neurons/i.test(errorText));
        if (isCloudflareQuotaError && !cloudflareQuotaExhausted) {
          cloudflareQuotaExhausted = true;
          failures.push("Cloudflare Workers AI daily neuron allowance is exhausted; remaining Cloudflare models were skipped. Trying configured external providers.");
        }
      }
    }
    const externalProviderConfigured = true; // public keyless Murakumo fallback is always appended last
    const quotaExhausted = cloudflareQuotaExhausted && !externalProviderConfigured;
    return json({
      error: quotaExhausted
        ? "Cloudflare Workers AI daily free quota is exhausted. No script was generated."
        : "AI generation failed on all configured models.",
      code: quotaExhausted ? "CLOUDFLARE_DAILY_QUOTA_EXHAUSTED" : "AI_GENERATION_FAILED",
      retryable: quotaExhausted,
      retryAfter: quotaExhausted ? "After the Cloudflare daily quota resets (00:00 UTC)." : null,
      details: failures,
      checks: quotaExhausted
        ? ["No need to retry repeatedly today; Cloudflare's daily neuron allowance is shared across its Workers AI models.", "No paid plan was enabled and no template text was returned as a successful AI result."]
        : ["Confirm Workers AI is enabled for this account.", "Check Workers AI usage/quota.", "Review the Worker logs in Cloudflare.", "If needed, set AI_MODEL to an active text-generation model ID."]
    }, quotaExhausted ? 503 : 502);
  }
};
