const fs = require('node:fs');
const assert = require('node:assert/strict');

const workflowPath = '.github/workflows/luna-browser-media-smoke.yml';
const source = fs.readFileSync(workflowPath, 'utf8');
const trigger = source.match(/^on:\\s*\\n([\\s\\S]*?)(?=^permissions:|^jobs:)/m)?.[1];
assert.ok(trigger, 'Live browser media smoke trigger block must exist');
assert.match(trigger, /^  workflow_dispatch:\\s*$/m, 'Live browser media smoke must be manually dispatched');
assert.doesNotMatch(trigger, /^  (?:push|pull_request|schedule):/m, 'Live media smoke must never run automatically and consume provider quota');
assert.match(trigger, /confirm_resource_usage:[\\s\\S]*?required:\\s*true[\\s\\S]*?type:\\s*boolean[\\s\\S]*?default:\\s*false/, 'Live media smoke must require explicit boolean quota confirmation defaulting to false');
assert.match(source, /inputs\\.confirm_resource_usage\\s*==\\s*true/, 'Live media smoke job must require explicit resource confirmation');
assert.match(source, /github\\.ref\\s*==\\s*'refs\\/heads\\/main'/, 'Live media smoke job must be restricted to main');
assert.match(source, /sudo apt-get install --yes ffmpeg/, 'Live media smoke must install independent FFmpeg/FFprobe validation tools');

for (const output of ['luna-final-assembled.webm', 'luna-voiced-animatic.webm']) {
  const command = 'node tests/media-integrity/validate-media.mjs luna-test-output/' + output + ' --container webm --require-audio';
  assert.ok(source.includes(command), 'Live media smoke must require full audio/video validation for ' + output);
}

console.log('LIVE_MEDIA_SMOKE_VALIDATION_GUARD: PASS');
