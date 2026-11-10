const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync('.github/workflows/luna-browser-media-smoke.yml', 'utf8');
const triggerStart = source.indexOf('\non:');
const triggerEnd = source.indexOf('\npermissions:', triggerStart);
assert.ok(triggerStart >= 0 && triggerEnd > triggerStart, 'Live browser media smoke trigger block must exist');
const trigger = source.slice(triggerStart, triggerEnd);
assert.ok(trigger.includes('  workflow_dispatch:'), 'Live browser media smoke must be manually dispatched');
for (const forbidden of ['  push:', '  pull_request:', '  schedule:']) {
  assert.ok(!trigger.includes(forbidden), 'Live media smoke must not run automatically: ' + forbidden.trim());
}
assert.ok(trigger.includes('confirm_resource_usage:') && trigger.includes('required: true') && trigger.includes('type: boolean') && trigger.includes('default: false'), 'Live media smoke must require explicit boolean quota confirmation defaulting to false');
assert.ok(source.includes('inputs.confirm_resource_usage == true'), 'Live media smoke job must require explicit resource confirmation');
assert.ok(source.includes("github.ref == 'refs/heads/main'"), 'Live media smoke job must be restricted to main');
assert.ok(source.includes('sudo apt-get install --yes ffmpeg'), 'Live media smoke must install independent FFmpeg/FFprobe validation tools');

for (const output of ['luna-final-assembled.webm', 'luna-voiced-animatic.webm']) {
  const command = 'node tests/media-integrity/validate-media.mjs luna-test-output/' + output + ' --container webm --require-audio';
  assert.ok(source.includes(command), 'Live media smoke must require full audio/video validation for ' + output);
}

console.log('LIVE_MEDIA_SMOKE_VALIDATION_GUARD: PASS');
