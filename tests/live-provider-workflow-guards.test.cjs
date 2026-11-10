const fs = require('node:fs');
const assert = require('node:assert/strict');

const cases = [
  {path: '.github/workflows/check-worker.yml', input: 'confirm_image_quota', job: 'check'},
  {path: '.github/workflows/luna-wan-video-proof.yml', input: 'confirm_video_quota', job: 'wan-video-proof'}
];

for (const item of cases) {
  const source = fs.readFileSync(item.path, 'utf8');
  const trigger = source.match(/^on:\s*\n([\s\S]*?)(?=^permissions:|^jobs:)/m)?.[1];
  assert.ok(trigger, item.path + ': workflow trigger block must exist');
  assert.match(trigger, /^  workflow_dispatch:\s*$/m,
    item.path + ': live provider workflow must be manually dispatched');
  assert.doesNotMatch(trigger, /^  (?:push|pull_request|schedule):/m,
    item.path + ': live provider workflow must not run automatically');

  const inputPattern = new RegExp(
    '^      ' + item.input + ':\\s*\\n((?:^        .*\\n|^\\s*\\n)*)', 'm'
  );
  const inputBlock = source.match(inputPattern)?.[1] || '';
  assert.match(inputBlock, /required:\s*true/,
    item.path + ': explicit quota confirmation must be required');
  assert.match(inputBlock, /type:\s*boolean/,
    item.path + ': quota confirmation must be a boolean');
  assert.match(inputBlock, /default:\s*false/,
    item.path + ': quota confirmation must default to false');

  const jobPattern = new RegExp(
    '^  ' + item.job + ':\\s*\\n([\\s\\S]*?)(?=^  [A-Za-z0-9_-]+:|^$)', 'm'
  );
  const jobBlock = source.match(jobPattern)?.[1] || '';
  assert.match(jobBlock, new RegExp('inputs\\.' + item.input + '\\s*==\\s*true'),
    item.path + ': live provider job must require explicit confirmation');
  assert.match(jobBlock, /github\.ref\s*==\s*'refs\/heads\/main'/,
    item.path + ': live provider job must be restricted to main');

  console.log('QUOTA_GUARD: PASS — ' + item.path);
}

console.log('LIVE_PROVIDER_WORKFLOW_GUARDS: PASS');
