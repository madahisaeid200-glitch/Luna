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


const validator = fs.readFileSync('tests/media-integrity/validate-media.mjs', 'utf8');
assert.ok(validator.includes('function packetTiming(selector, label)'),
  'Each media stream duration must be measured independently from its packets');
assert.ok(validator.includes("'-show_packets'"), 'Media validation must inspect packet timestamps and durations');
assert.ok(validator.includes('packet=pts_time,duration_time'), 'Packet timing must include both timestamps and durations');
assert.ok(!validator.includes('video.duration || formatDuration') && !validator.includes('audio.duration || formatDuration'),
  'Container duration must never be substituted for missing stream duration');
assert.ok(validator.includes('refusing to substitute container duration'),
  'Unknown stream packet timing must fail closed rather than masking an A/V mismatch');
assert.ok(validator.includes('format=start_time,duration'),
  'FFprobe must expose the container start time and duration');
assert.ok(validator.includes('const timelineStart = audioTiming ? Math.min(videoTiming.start, audioTiming.start) : videoTiming.start;'),
  'Container timing must be compared against the complete stream timeline');
assert.ok(validator.includes('Container/stream duration mismatch exceeds 0.25 s'),
  'Material container-versus-stream duration drift must fail closed');
assert.ok(validator.includes('Container end-time mismatch exceeds 0.25 s'),
  'Container end time must be checked when its start time is available');
const fixtures = fs.readFileSync('tests/media-integrity/run-fixtures.sh', 'utf8');
assert.ok(fixtures.includes('container-duration-mismatch.mp4'),
  'Fixture suite must include a container/stream duration mismatch');
assert.ok(fixtures.includes('corrupt-mp4-container-duration.mjs'),
  'Container mismatch fixture must alter container metadata without changing media packets');

console.log('LIVE_MEDIA_SMOKE_VALIDATION_GUARD: PASS');
