const { chromium } = require("playwright");

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
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://orange-firefly-6434.madahisaeid200.workers.dev/**", async route => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }});
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, mode: "director", provider: "ovhcloud", model: "Meta-Llama-3_3-70B-Instruct", plan })
    });
  });

  try {
    const response = await page.goto("http://127.0.0.1:8000/producer.html", { waitUntil: "domcontentloaded" });
    if (!response || !response.ok()) throw new Error("Producer page did not load");
    const draftText = "The Five-Star Name Mix-Up\\nLUNA: " + words[0] + "\\nLEO: " + words[1];
    await page.evaluate((draft) => {
      localStorage.setItem("lunaAiEndpoint", "https://orange-firefly-6434.madahisaeid200.workers.dev");
      window.eval("lastDraft = " + JSON.stringify(draft) + ";");
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
    if (!result.pack.includes("IMAGE PROMPTS") || !result.pack.includes("VIDEO / MOTION PROMPTS")) throw new Error("Director plan was not converted into a media production pack");
    if (result.parsed.shots.length !== 6) throw new Error("Production parser did not recover all six shots");
    if (result.parsed.shots.some((shot, index) => !shot.imagePrompt || !shot.motionPrompt)) throw new Error("One or more image/motion prompts were not mapped to the shot list");
    if (!result.imagePrompt.includes("reference still")) throw new Error("First reference-frame prompt was not placed in the image prompt field");
    if (speakers.some((speaker, index) => !result.voiceText.includes(speaker + ": " + words[index]))) throw new Error("Exact screenplay dialogue was not mapped into voice text");
    if (result.imageButtonDisabled) throw new Error("Image generation was not enabled after Director planning");
    if (result.directorDownloadDisabled) throw new Error("Director JSON download was not enabled");
    if (errors.length) throw new Error("Browser errors: " + errors.join(" | "));
    console.log("PASS: Producer Director UI → production pack → six parsed shots");
    console.log("PASS: all six image prompts and six motion prompts mapped");
    console.log("PASS: exact six dialogue lines mapped to voice text");
    console.log("PASS: image generation and Director JSON download controls enabled");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
