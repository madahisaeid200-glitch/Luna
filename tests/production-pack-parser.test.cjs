const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync('producer.html', 'utf8');
const start = html.indexOf('function parseProductionPack(pack){');
const end = html.indexOf("\n  el('exportProductionJson').onclick", start);
assert.ok(start >= 0 && end > start, 'parser function must exist in producer.html');
const parserSource = html.slice(start, end).trim().replace(/\n\s*$/, '');
const parseProductionPack = vm.runInNewContext('(' + parserSource + ')');

const markdown = `# EPISODE SUMMARY
A luxury hotel misunderstanding.

## CHARACTER CONTINUITY
Luna wears a silver evening dress. Leo wears a navy suit.

## SHOT LIST
Shot 1 — Hotel entrance
Duration: 8 seconds
Camera: Wide tracking shot
Action: Leo drops the key card.
Emotion: Embarrassed
Dialogue: Leo: "That was not my room!"

SHOT 2 — Reception
Duration: 12 seconds
Camera: Medium close-up
Action: Luna laughs.
Dialogue: Luna: "Again?"

## IMAGE PROMPTS
Shot 1: Elegant European hotel entrance at night, cinematic lighting.
Shot 2: Stylish woman laughing at a hotel reception.

## VIDEO/MOTION PROMPTS
Shot 1: Slow camera push-in as the key card falls.
Shot 2: Gentle handheld camera movement.

## VOICE AND SOUND
Soft piano and hotel ambience.

## ON-SCREEN CAPTIONS
That was not my room!

## EDITING PLAN
Quick comedic cut.

## FINAL QUALITY CHECK
Keep character outfits consistent.`;

const result = parseProductionPack(markdown);
assert.equal(result.productionSections.episodeSummary, 'A luxury hotel misunderstanding.');
assert.ok(result.productionSections.characterContinuity.includes('silver evening dress'));
assert.equal(result.shots.length, 2);
assert.equal(result.shots[0].id, 1);
assert.equal(result.shots[0].duration, '8 seconds');
assert.equal(result.shots[0].camera, 'Wide tracking shot');
assert.equal(result.shots[0].action, 'Leo drops the key card.');
assert.equal(result.shots[0].emotion, 'Embarrassed');
assert.equal(result.shots[0].dialogue, 'Leo: "That was not my room!"');
assert.ok(result.shots[0].imagePrompt.includes('European hotel entrance'));
assert.ok(result.shots[0].motionPrompt.includes('camera push-in'));
assert.ok(result.shots[1].imagePrompt.includes('woman laughing'));
assert.ok(result.shots[1].motionPrompt.includes('handheld'));
assert.ok(result.shotListRaw.toLowerCase().includes('shot 2'));

const unknown = parseProductionPack('Unstructured model output that must remain intact.');
assert.equal(unknown.shots.length, 0);
assert.equal(unknown.shotListRaw, '');
console.log('LUNA production-pack parser: all assertions passed.');
