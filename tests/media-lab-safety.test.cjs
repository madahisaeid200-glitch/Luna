'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');

const html = fs.readFileSync('media-lab.html', 'utf8');
const deploy = fs.readFileSync('.github/workflows/deploy-cloudflare-pages.yml', 'utf8');

assert.match(html, /id="makeMp4"[^>]*disabled/,
  'MP4 test must start disabled until browser encoder capabilities are checked');
assert.match(html, /lastReport=report;\s*mp4Button\.disabled=!report\.tests\.minimumEncoderGate/,
  'MP4 test must be enabled only when both required encoder configurations are supported');
assert.match(html, /if\(!lastReport\|\|lastReport\.tests\?\.minimumEncoderGate!==true\)/,
  'MP4 click handler must enforce the capability gate independently of the button state');
assert.match(html, /\$\('run'\)\.disabled=false;mp4Button\.disabled=true/,
  'A failed capability check must leave the MP4 test disabled');
assert.match(html, /import\('https:\/\/cdn\.jsdelivr\.net\/npm\/mediabunny@1\.65\.2\/\+esm'\)/,
  'The media tool must use the explicitly pinned Mediabunny version');
assert.doesNotMatch(html, /\bfetch\s*\(|XMLHttpRequest|WebSocket/,
  'The local media test must not upload media or open arbitrary network requests');
assert.match(html, /networkNote:'Only the library module was fetched; no media was uploaded\.'/,
  'The generated MP4 report must explicitly state its local-only data path');
assert.match(html, /await output\.finalize\(\);[\s\S]{0,180}output\.target\.buffer/,
  'The generated MP4 buffer must only be read after output finalization');
assert.match(html, /signature!=='ftyp'/,
  'The generated file must pass the MP4 container signature check');
assert.match(html, /width!==360\|\|height!==640/,
  'The generated file dimensions must be validated');
assert.match(html, /duration<1\.8\|\|duration>2\.2/,
  'The generated file duration must be validated');
assert.match(html, /Expected H\.264\/AVC video/);
assert.match(html, /Expected AAC-LC audio/);
assert.match(html, /!videoDecodable\|\|!audioDecodable/,
  'Both encoded tracks must pass browser decoding before the test is considered successful');
assert.match(html, /URL\.revokeObjectURL\(lastMp4ObjectUrl\)/,
  'The previous local preview object URL must be released before a new run');
assert.match(deploy, /cp reels\.html media-lab\.html dist\//,
  'Cloudflare Pages bundle must include both local workspaces');

console.log('Media lab capability gate and local MP4 integrity safeguards passed.');
