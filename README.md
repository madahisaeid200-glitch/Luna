# LUNA Studio

A lightweight browser-first production workspace for the LUNA & LEO virtual couple.

## Current architecture

- `index.html`: episode dashboard and saved episode list (browser-local storage).
- `producer.html`: script drafting, character profiles, production-pack creation, image workflow and a short browser preview.
- `worker.js`: Cloudflare Worker AI backend (script, production-pack, image and optional vision modes).
- `_worker.js`: Cloudflare Pages same-origin `/api` proxy to the existing AI Worker.

The GitHub Pages site is the primary working deployment. Cloudflare Pages deployment is optional and currently requires a Cloudflare API token with the correct account permissions.

## Portable production-pack export

After generating a script and then a production pack in the Producer, use **Export standard JSON for video engine** to download `LUNA-production-pack.json`.

Schema version: `luna-production-pack@1.0.0`

Top-level fields:

- `episode`: title, premise, duration, tone and language.
- `characters`: the saved Luna/Leo character bible.
- `episodeScript`: the finished episode script.
- `productionPackMarkdown`: the complete AI production pack, including shot list, image prompts, motion prompts, voice/sound, captions and editing plan.
- `firstImagePrompt`: convenience field for the first scene image prompt.
- `targetFormats`: intended aspect-ratio targets (9:16 and 16:9).

This is an interchange/export format; it does not itself render a finished video or invoke an AI model. Keeping the export self-contained allows a future renderer (for example a separately hosted Remotion service) to be added without replacing the existing browser app or AI Worker.

## Video rendering roadmap

1. Keep the current browser preview as a lightweight fallback.
2. Convert the shot list and prompts into validated scene records.
3. Add a separately hosted render service for MP4 output; do not attempt to run a full Node/FFmpeg renderer inside GitHub Pages.
4. Add voice generation, captions and music only as independent optional stages, so one failed stage does not block the rest.

## Privacy and storage

Episode drafts, character profiles and generated images are currently stored in the browser used to create them. Export important work before clearing browser data or changing devices.
