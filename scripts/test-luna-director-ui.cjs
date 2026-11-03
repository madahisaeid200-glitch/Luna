const { chromium } = require("playwright");
const fs = require("fs");
const producerSource = fs.readFileSync("producer.html", "utf8");
const workerSource = fs.readFileSync("worker.js", "utf8");
if (workerSource.indexOf("const pollinationsFailures = [];") < 0 || workerSource.indexOf("const pollinationsFailures = [];") > workerSource.indexOf("const hokusaiFailures = [];")) {
  throw new Error("Worker must attempt the no-key FLUX route before the Hokusai fallback");
}
if (workerSource.includes('imageUrl.searchParams.set("model", "flux")')) {
  throw new Error("Do not force a model selector on the verified anonymous legacy Pollinations endpoint");
}
if (!workerSource.includes("upstreamHttpStatus: response.status") || !workerSource.includes("bytes.length < 10_000")) {
  throw new Error("Pollinations fallback must validate image MIME and byte size while preserving upstream status");
}
const pollinationsBlock = workerSource.slice(workerSource.indexOf("const pollinationsFailures = [];"), workerSource.indexOf("const hokusaiFailures = [];"));
if (!pollinationsBlock.includes("if (!response.ok)")) {
  throw new Error("Pollinations HTTP error placeholders must never be returned as real images");
}
function jpegDimensions(dataUrl) {
  const bytes = Buffer.from(String(dataUrl).split(",")[1] || "", "base64");
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset++; continue; }
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    }
    if (length < 2) break;
    offset += 2 + length;
  }
  return null;
}
for (const required of ["Math.max(0,6-generatedSceneImages.length)", "slice(0,6)", "for(let i=0;i<6;i++)", "generatedWanClipUrls.length!==6", "prepareLunaReferenceImage(generatedImageData,480,0.88)", "generatedSceneImages.slice(0,6).map(item=>item.dataUrl)", "independentSceneCount=Math.min(6,generatedSceneImages.length)", "{name:'THE REVEAL'", "{name:'HAPPY ENDING'", "شش برش، زیرنویس و صدای واقعی."]) {
  if (!producerSource.includes(required)) throw new Error("Six-shot production guard missing: " + required);
}

const speakers = ["LUNA", "LEO", "LUNA", "LEO", "LUNA", "LEO"];
const words = [
  "This welcome card has the wrong names on it, what's going on here exactly now.",
  "I typed the wrong surname on our anniversary reservation, I'm so terribly sorry about this.",
  "You booked this suite for another couple or someone else, that's really quite amusing to me.",
  "I made the typo and I accept it, let's just enjoy our stay and make the most of it together.",
  "Well, at least we're getting a five-star mix-up, and I love you for the laugh and the luxury.",
  "I love you too, and I promise to get it right next time, with an even better surprise for you."
];
const shots = speakers.map((speaker, index) => ({
  id: "S0" + (index + 1),
  durationSeconds: 6,
  location: "The same luxury hotel suite",
  shotType: ["wide", "close-up", "medium", "over-shoulder", "medium", "close-up"][index],
  characters: index % 2 ? ["LEO"] : ["LUNA", "LEO"],
  action: speaker + " delivers the exact line and reacts naturally in the same hotel suite.",
  emotion: "Warm romantic comedy",
  dialogue: [{ speaker, text: words[index] }],
  videoPrompt: "Photorealistic continuous live-action vertical 9:16 shot in the same luxury hotel suite. " + speaker + " delivers the exact line with subtle natural movement, consistent wardrobe, facial identity and cinematic lighting. Shot " + (index + 1) + ".",
  referenceFramePrompt: "Photorealistic vertical 9:16 reference still in the same luxury hotel suite, " + speaker + " with the same fixed face, hair, wardrobe and natural skin texture, carefully composed " + (index + 1) + " framing with coherent warm cinematic lighting.",
  audio: { ambience: "Quiet hotel suite", sfx: "Natural room tone", musicMood: "Romantic comedy" },
  transition: "cut"
}));
const plan = {
  schemaVersion: "luna-video-plan@1.0.0",
  episode: { title: "The Five-Star Name Mix-Up", logline: "A welcome-card typo becomes a romantic comedy.", targetAspectRatio: "9:16", targetDurationSeconds: 36 },
  continuityBible: {
    luna: "Adult woman with long glossy chestnut-brown hair and elegant European appearance.",
    leo: "Adult stylish European man with masculine tailored luxury styling.",
    visualStyle: "Photorealistic cinematic luxury European hotel with natural skin texture.",
    continuityRules: ["Same hotel suite throughout.", "Preserve both identities and outfits.", "Only LUNA and LEO appear."]
  },
  shots,
  captions: [],
  qualityGates: ["Preserve exact dialogue and chronology."]
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  const errors = [];
  let imageRequests = 0, imageEditRequests = 0, videoRequests = 0;
  const imagePrompts = [], editPrompts = [];
  const editImageDimensions = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://orange-firefly-6434.madahisaeid200.workers.dev/**", async route => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }});
    }
    const payload = JSON.parse(route.request().postData() || "{}");
    if (payload.mode === "director") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: true, mode: "director", provider: "ovhcloud", model: "Meta-Llama-3_3-70B-Instruct", plan })
      });
    }
    if (payload.mode === "image" || payload.mode === "image_edit") {
      if (payload.mode === "image") { imageRequests++; imagePrompts.push(String(payload.script || "")); } else { imageEditRequests++; editPrompts.push(String(payload.prompt || "")); editImageDimensions.push(jpegDimensions(payload.image)); }
      const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/XioAAAAASUVORK5CYII=";
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ image: png, mimeType: "image/png", model: "test-fixture" }) });
    }
    if (payload.mode === "video") {
      videoRequests++;
      return route.fulfill({ status: 200, contentType: "video/webm", headers: { "Access-Control-Allow-Origin": "*" }, body: Buffer.alloc(60000, 1) });
    }
    return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Unexpected test mode: " + payload.mode }) });
  });

  try {
    const response = await page.goto("http://127.0.0.1:8000/producer.html", { waitUntil: "domcontentloaded" });
    if (!response || !response.ok()) throw new Error("Producer page did not load");
    const draftText = "The Five-Star Name Mix-Up\\nLUNA: " + words[0] + "\\nLEO: " + words[1];
    await page.evaluate((draft) => {
      localStorage.setItem("lunaAiEndpoint", "https://orange-firefly-6434.madahisaeid200.workers.dev");
      window.eval("lastDraft = " + JSON.stringify(draft) + ";");
      document.querySelector("#makeDirectorPlan").disabled = false;
    }, draftText);
    await page.locator("#makeDirectorPlan").click();
    await page.waitForFunction(() =>
      (document.querySelector("#aiStatus")?.textContent || "").includes("نقشه کارگردانی به بسته تولید متصل شد"),
      null,
      { timeout: 15000 }
    );
    const result = await page.evaluate(() => ({
      pack: window.eval("lastProductionPack"),
      parsed: window.eval("parseProductionPack(lastProductionPack)"),
      imagePrompt: document.querySelector("#imagePrompt")?.value || "",
      voiceText: document.querySelector("#voiceTestText")?.value || "",
      imageButtonDisabled: document.querySelector("#generateSceneImage")?.disabled,
      directorDownloadDisabled: document.querySelector("#downloadDirectorPlan")?.disabled,
      output: document.querySelector("#output")?.textContent || ""
    }));
    console.log("DIRECTOR_PACK_PREVIEW:", result.pack.slice(0,1800));
    console.log("PARSED_SHOT_COUNT:", result.parsed.shots.length, "SHOT_LIST_PREVIEW:", result.parsed.shotListRaw.slice(0,1400));
    if (!result.pack.includes("IMAGE PROMPTS") || !result.pack.includes("VIDEO / MOTION PROMPTS")) throw new Error("Director plan was not converted into a media production pack");
    if (result.parsed.shots.length !== 6) throw new Error("Production parser did not recover all six shots; parsed=" + result.parsed.shots.length + "; raw=" + result.parsed.shotListRaw.slice(0,500));
    if (result.parsed.shots.some((shot, index) => !shot.imagePrompt || !shot.motionPrompt)) throw new Error("One or more image/motion prompts were not mapped to the shot list");
    if (!result.imagePrompt.includes("reference still")) throw new Error("First reference-frame prompt was not placed in the image prompt field");
    if (speakers.some((speaker, index) => !result.voiceText.includes(speaker + ": " + words[index]))) throw new Error("Exact screenplay dialogue was not mapped into voice text");
    if (result.imageButtonDisabled) throw new Error("Image generation was not enabled after Director planning");
    if (result.directorDownloadDisabled) throw new Error("Director JSON download was not enabled");
    await page.locator("#generateSceneImage").click();
    await page.waitForFunction(() => window.eval("generatedSceneImages.length") === 1, null, { timeout: 10000 });
    await page.locator("#generateMoreScenes").click();
    await page.waitForFunction(() => window.eval("generatedSceneImages.length") === 6, null, { timeout: 15000 });
    if (imageRequests !== 1 || imageEditRequests !== 5) throw new Error("Expected one initial image plus five reference edits; got image=" + imageRequests + " edits=" + imageEditRequests);
    if (!imagePrompts[0].includes("IS THE MAN") || !imagePrompts[0].includes("modern five-star hotel suite")) throw new Error("Initial image prompt lost LEO gender or hotel-location lock: " + imagePrompts[0].slice(0,700));
    if (editPrompts.some(prompt => !prompt.includes("is the MAN") || !prompt.includes("never female"))) throw new Error("A reference-edit prompt lost LEO gender continuity.");
    if (editImageDimensions.some(size => !size || size.width !== 480 || size.height !== 480)) throw new Error("Reference images must be normalized to 480x480 before FLUX.2 Klein: " + JSON.stringify(editImageDimensions));
    if (await page.locator("#generateWanClips").isDisabled()) throw new Error("Wan generation did not enable after six images");
    await page.locator("#generateWanClips").click();
    await page.waitForFunction(() => window.eval("generatedWanClipUrls.length") === 6, null, { timeout: 15000 });
    const mediaState = await page.evaluate(() => ({
      imageCount: window.eval("generatedSceneImages.length"),
      clipCount: window.eval("generatedWanClipUrls.length"),
      cards: document.querySelectorAll("#wanClipList video").length,
      assembleDisabled: document.querySelector("#assembleWanClips")?.disabled
    }));
    if (videoRequests !== 6 || mediaState.imageCount !== 6 || mediaState.clipCount !== 6 || mediaState.cards !== 6 || mediaState.assembleDisabled) throw new Error("Six-shot media pipeline mismatch: " + JSON.stringify({ videoRequests, mediaState }));
    if (errors.length) throw new Error("Browser errors: " + errors.join(" | "));
    console.log("PASS: Producer Director UI → production pack → six parsed shots");
    console.log("PASS: all six image prompts and six motion prompts mapped");
    console.log("PASS: exact six dialogue lines mapped to voice text");
    console.log("PASS: one initial image + five reference-image scene generations");
    console.log("PASS: all five reference images normalized to 480x480 for FLUX.2 Klein");
    console.log("PASS: six Wan clip requests, six clip cards and assembly enabled");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
