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
