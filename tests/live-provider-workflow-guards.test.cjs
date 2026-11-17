const fs = require('node:fs');
const assert = require('node:assert/strict');

const cases = [
  {path: '.github/workflows/check-worker.yml', input: 'confirm_image_quota', job: 'check', gate: 'shell'},
  {path: '.github/workflows/luna-wan-video-proof.yml', input: 'confirm_video_quota', job: 'wan-video-proof', gate: 'job'}
];

for (const item of cases) {
  const source = fs.readFileSync(item.path, 'utf8');
  const trigger = source.match(/^on:\s*\n([\s\S]*?)(?=^permissions:|^jobs:)/m)?.[1];
  assert.ok(trigger, item.path + ': workflow trigger block must exist');
  assert.match(trigger, /^  workflow_dispatch:\s*$/m, item.path + ': live provider workflow must be manually dispatched');
  assert.doesNotMatch(trigger, /^  (?:push|pull_request|schedule):/m, item.path + ': live provider workflow must not run automatically');

  const inputPattern = new RegExp('^      ' + item.input + ':\\s*\\n((?:^        .*\\n|^\\s*\\n)*)', 'm');
  const inputBlock = source.match(inputPattern)?.[1] || '';
  assert.match(inputBlock, /required:\s*true/, item.path + ': explicit quota confirmation must be required');
  assert.match(inputBlock, /type:\s*boolean/, item.path + ': quota confirmation must be a boolean');
  assert.match(inputBlock, /default:\s*false/, item.path + ': quota confirmation must default to false');

  const jobStart = source.indexOf('  ' + item.job + ':');
  const stepsStart = source.indexOf('    steps:', jobStart);
  assert.ok(jobStart >= 0 && stepsStart > jobStart, item.path + ': job definition must contain steps');
  const jobHeader = source.slice(jobStart, stepsStart);
  assert.match(jobHeader, /github\.event_name\s*==\s*'workflow_dispatch'/, item.path + ': job must only run for manual dispatch');
  assert.match(jobHeader, /github\.ref\s*==\s*'refs\/heads\/main'/, item.path + ': job must be restricted to main');

  if (item.gate === 'job') {
    assert.match(jobHeader, new RegExp('inputs\\.' + item.input + '\\s*==\\s*true'), item.path + ': live provider job must require explicit confirmation');
  } else {
    assert.doesNotMatch(jobHeader, new RegExp('inputs\\.' + item.input), item.path + ': safe Worker diagnostics must not require live quota approval');
    assert.match(source, new RegExp('CONFIRM_IMAGE_QUOTA:\\s*\\$\\{\\{\\s*inputs\\.' + item.input + '\\s*\\}\\}'), item.path + ': quota confirmation must be passed to the diagnostic shell');
    const safeStart = source.indexOf('echo "1/3 GET health check"');
    const liveStart = source.indexOf('echo "4/4 Real FLUX image generation');
    assert.ok(safeStart >= 0 && liveStart > safeStart, item.path + ': safe checks must precede live generation');
    const beforeLive = source.slice(safeStart, liveStart);
    assert.match(beforeLive, /echo "2\/3 Small POST check"/);
    assert.match(beforeLive, /echo "3\/3 58 KB image-shaped POST check"/);
    const guardStart = source.indexOf('if [[ "${CONFIRM_IMAGE_QUOTA}"');
    assert.ok(guardStart > 0 && guardStart < liveStart, item.path + ': live generation guard must precede provider calls');
    const liveGuard = source.slice(guardStart, liveStart);
    assert.match(liveGuard, /!= "true"/);
    assert.match(liveGuard, /exit 0/);
    assert.match(liveGuard, /explicit quota confirmation/);
    const worker = fs.readFileSync('worker.js', 'utf8');
    const imagePingStart = worker.indexOf('if (mode === "image_ping")');
    const videoHealthStart = worker.indexOf('if (mode === "video_health")', imagePingStart);
    assert.ok(imagePingStart >= 0 && videoHealthStart > imagePingStart, 'Worker must retain the non-generative image_ping branch');
    const imagePingBlock = worker.slice(imagePingStart, videoHealthStart);
    assert.match(imagePingBlock, /return json\(\{ ok: true, receivedImageChars:/, 'image_ping must return a payload receipt');
    assert.doesNotMatch(imagePingBlock, /env\.AI|fetch\(/, 'image_ping must not invoke model bindings or external provider calls');
  }
  console.log('QUOTA_GUARD: PASS — ' + item.path);
}

console.log('LIVE_PROVIDER_WORKFLOW_GUARDS: PASS');