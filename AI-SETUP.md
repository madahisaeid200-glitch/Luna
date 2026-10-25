# LUNA AI endpoint setup

The public GitHub Pages app must never contain an OpenAI API key. This Cloudflare Worker is a small private-key proxy for the Episode Producer.

## 1. Create the Worker
1. Sign in to Cloudflare and open **Workers & Pages**.
2. Create a Worker named `luna-ai-producer`.
3. Replace its starter code with the complete contents of `worker.js` from this repository and deploy it.
4. In Worker **Settings → Variables and Secrets**, add a secret named `OPENAI_API_KEY` with your API key. Do not put the key in GitHub or in the webpage.
5. Optional: add a text variable `OPENAI_MODEL` if you want to override the default model. The default in this Worker is `gpt-4.1-mini`.
6. Copy the deployed Worker URL (for example, `https://luna-ai-producer.<your-subdomain>.workers.dev`).

## 2. Connect the page
Open https://madahisaeid200-glitch.github.io/Luna/producer.html. In the **AI connection** section, paste the Worker URL and press **Save connection**. Then generate a script. The URL is saved only in that browser; the API key stays on the Worker.

## 3. Billing and safety
- API usage is billed separately by the API provider; ChatGPT subscriptions do not automatically include API credit.
- Never paste an API key into the public page or a chat.
- The Worker accepts requests only from the LUNA GitHub Pages origin and limits title/premise sizes. If you later move the site to another domain, update `ALLOWED_ORIGIN` in `worker.js`.
- Test with a short prompt first and review provider usage limits.
- This endpoint generates scripts only. Image/video generation is a separate integration and may incur separate costs.
