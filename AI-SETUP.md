# LUNA AI endpoint setup — low-cost Cloudflare Workers AI

This setup uses Cloudflare Workers AI so you do not need an OpenAI API account or an OpenAI API key. The public GitHub Pages app must never contain provider secrets.

## 1. Open Cloudflare
1. Sign in to Cloudflare (create a free account if needed): https://dash.cloudflare.com/
2. Open **Workers & Pages** and open the existing Worker named `orange-firefly-6434` (the app is already configured to use it). Do not create a second Worker unless the existing one is unavailable.
3. The repository now deploys this Worker automatically through GitHub Actions whenever `worker.js` or `wrangler.toml` changes. Do not paste code manually for routine updates. The deployment workflow uses `wrangler.toml`, whose canonical Worker name is `orange-firefly-6434`.
   - File: https://github.com/madahisaeid200-glitch/Luna/blob/main/worker.js

## 2. Add the Workers AI binding
1. Open your new Worker and choose **Settings → Bindings** (the exact menu wording may vary).
2. Select **Add binding** and choose **Workers AI**.
3. Set the variable/binding name to exactly `AI`.
4. Save and deploy the Worker again. The binding name must be exactly `AI`.
5. Do not create an OpenAI API key or paste any key into the website. The default text model in the current code is `@cf/meta/llama-3.1-8b-instruct-fast`; it falls back to `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. The deployment file also declares the Workers AI binding as `AI`.

## 3. Connect LUNA
1. Open https://madahisaeid200-glitch.github.io/Luna/producer.html
2. In **AI Connection**, paste your Worker URL, normally ending in `.workers.dev`.
3. Press **Save connection**.
4. Enter an episode title and premise, choose the language and length, then press **Generate episode draft**. The status message should confirm that an AI-generated script was returned.

## 4. Quick diagnosis\n- Open the Worker URL directly in a browser. The updated Worker should return JSON with `ok: true` and `aiBinding: true`; if you see `Use POST.` you are still running the older Worker code, so paste the current `worker.js` into Cloudflare and deploy.\n- If the connection test passes but generation fails, read the detailed error beside **AI Connection**. It may identify a model error or usage/quota issue.\n- The GitHub Pages workflow deploys the website. A separate GitHub Actions workflow deploys the Worker. Check the `Deploy LUNA AI Worker` run in GitHub Actions if Worker code was changed.\n\n## 5. Costs and limits
- Cloudflare Workers AI currently includes 10,000 Neurons per day on its free allocation. If you use up the allocation, requests may stop until the daily reset unless you enable paid usage. See https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare Workers also has a free plan for the Worker endpoint. See https://developers.cloudflare.com/workers/platform/pricing/
- Usage limits and model availability can change; check the Cloudflare dashboard before relying on it for production.
- This endpoint generates scripts only. Image/video generation is a separate integration and may cost extra.
- Keep the Worker restricted to the LUNA site origin. Do not publish provider tokens or secrets in GitHub, the browser, or this public repository.

## 6. Automatic free-provider fallback (new)

The Worker now tries providers in this order for episode-script generation:

1. Cloudflare Workers AI (existing primary and secondary models).
2. Mistral API Free mode, when `MISTRAL_API_KEY` is configured (default model: `mistral-small-latest`).
3. Groq, when `GROQ_API_KEY` is configured.
4. OpenRouter's free-model router, when `OPENROUTER_API_KEY` is configured.

When Cloudflare returns its daily quota error, the Worker now skips only the remaining Cloudflare models and continues to separately configured external providers. Provider errors move to the next configured provider. The Worker returns the actual provider and model used. It does not claim success when no model returns a real script.

### One-time setup — keys stay private

To activate the free fallback, create an API key from at least one provider:
- Groq: https://console.groq.com/keys — Free plan limits are per model and are shown in the Groq console.
- OpenRouter: https://openrouter.ai/settings/keys — use of free models is capped; current free-tier documentation lists 20 requests/minute and 50 requests/day for `:free` models.

Then add the key to the existing Cloudflare Worker as a **Secret**, not as a plain text variable:
1. Open https://dash.cloudflare.com/ and select Workers & Pages.
2. Open the existing Worker `orange-firefly-6434`.
3. Open Settings → Variables and Secrets (wording may vary).
4. Add a Secret named exactly `GROQ_API_KEY` and paste the Groq key into its value. If using OpenRouter, add another Secret named exactly `OPENROUTER_API_KEY`.
5. Save/deploy the Worker.

You can add only one provider key; both are not required. No API key should be sent in ChatGPT, pasted into the website, or committed to GitHub. The Worker health response exposes only true/false provider-presence flags, never key values.

Official references:
- Groq rate limits: https://console.groq.com/docs/rate-limits
- OpenRouter free models and limits: https://openrouter.ai/collections/free-models
- Cloudflare Worker Secrets: https://developers.cloudflare.com/workers/configuration/secrets/


## 7. Gemini free-tier testing (internal tests only)

The Worker also supports Gemini as an optional test provider. The text-generation fallback order is Cloudflare Workers AI → Groq → Gemini → OpenRouter. Gemini is attempted only when the `GEMINI_API_KEY` Secret is present. The default model is `gemini-3.5-flash-lite`; it can be overridden with the optional `GEMINI_MODEL` Worker variable.

For a limited internal test, create a key at https://aistudio.google.com/ and add it to the existing Cloudflare Worker as a **Secret** named exactly `GEMINI_API_KEY`. Never paste the key into ChatGPT, GitHub, or the public website. The Worker health endpoint reports only whether the Secret exists; it does not reveal the key or consume model quota.

Important restrictions: this Gemini route is for private/internal evaluation only, not for serving users of the public LUNA app on an unpaid API tier. Google's current additional terms require Paid Services when making API Clients available to users in the EEA, Switzerland, or the UK. Do not enable billing just for this test. Free-tier availability and model access can change. Also avoid sending personal, confidential, or sensitive information in test prompts.

Official references:
- Gemini API models: https://ai.google.dev/gemini-api/docs/models
- Gemini API pricing and free tier: https://ai.google.dev/gemini-api/docs/pricing
- Gemini API terms (effective March 23, 2026): https://ai.google.dev/gemini-api/terms

## 8. Mistral API Free mode (recommended fallback)

Mistral's official Studio quickstart says API access is enabled in Free mode with no credit card required; usage and rate limits apply. This is an included limited allowance, not unlimited free production capacity. Do not enable pay-as-you-go or add payment details for this setup.

1. Create an account and API key at https://console.mistral.ai/api-keys/ (or open Mistral Studio and choose API Keys).
2. Keep the key private. In the existing Cloudflare Worker `orange-firefly-6434`, add a **Secret** named exactly `MISTRAL_API_KEY` and paste the key there.
3. Save/deploy the Worker. The existing GitHub Actions Worker deployment will also deploy source changes; adding a secret is a separate Cloudflare dashboard action.
4. Open the Worker health URL. Its `providers.mistral` field should become `true`. This confirms only that the secret exists, not that generation has succeeded.
5. Run one real episode draft test in LUNA. A successful response must include a non-empty generated script and identify `provider: "mistral"` with the actual model. If the Free allowance is exhausted, the Worker must report the upstream error and must not return template text as AI success.

Default model: `mistral-small-latest`. You may optionally set a Worker variable `MISTRAL_MODEL` to another model available to your Free-mode organization. The Worker calls the official OpenAI-compatible chat-completions endpoint at `https://api.mistral.ai/v1/chat/completions`.

Official references:
- Mistral API key quickstart and Free-mode/no-card statement: https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key
- Mistral usage limits and Free-mode included monthly usage: https://docs.mistral.ai/admin/billing-usage/usage-limits
- Mistral API pricing: https://mistral.ai/pricing/api/


## 9. OpenRouter — easiest alternative when Mistral is blocked

OpenRouter's official developer page says you can create an API key and start without a subscription or payment card. Its free plan currently lists 25+ free models and a limit of 50 requests/day; free model calls are also limited to 20 requests/minute. This is limited free access, not unlimited production capacity.

1. Create an account at https://openrouter.ai/
2. After signing in, open https://openrouter.ai/settings/keys
3. Create an API key. Copy it once and keep it private.
4. In Cloudflare, open the existing Worker `orange-firefly-6434` → Settings → Variables and Secrets.
5. Add a Secret named exactly `OPENROUTER_API_KEY` and paste the key as its value. Do not add credits, choose a paid model, or enable auto top-up.
6. Save the Secret. The Worker deployment already supports OpenRouter and uses the free router model `openrouter/free` by default when no `OPENROUTER_MODEL` override is set.
7. Check the Worker health response: `providers.openrouter` should be `true`. Then run one real LUNA episode generation. Health only confirms the Secret is present; only a successful non-empty script confirms real model generation.

The current Worker source already contains the OpenRouter API integration. No source-code editing or manual code pasting is needed to add this provider; only the private Cloudflare Secret is required.

Official references:
- OpenRouter free signup and no-card API start: https://openrouter.ai/developers
- Free plan and rate limits: https://openrouter.ai/pricing
- Current free model catalogue: https://openrouter.ai/collections/free-models



## 8. NVIDIA NIM optional text fallback (added Nov 2, 2026)

The Worker supports NVIDIA's OpenAI-compatible NIM chat-completions API as an optional text-generation fallback. The default model is `nvidia/nemotron-3.5-bolt-e4b`; it can be overridden with `NVIDIA_MODEL`. The API endpoint is `https://integrate.api.nvidia.com/v1/chat/completions`. NVIDIA lists free API endpoints for developer prototyping; access, rate limits, and model availability are subject to NVIDIA account eligibility and current catalog status. Do not treat this as an unlimited production guarantee.

If NVIDIA access is available, add the API key to the existing Cloudflare Worker as a Secret named exactly `NVIDIA_API_KEY`. Optional model override: `NVIDIA_MODEL`. Never put the key in GitHub source, GitHub Pages, or this chat.

Mistral is another existing fallback option. Its official setup documentation says Free mode is enabled without a credit card, with usage and rate limits. Secret name: `MISTRAL_API_KEY`.
