const fs = require('node:fs');
const assert = require('node:assert/strict');

const workflow = fs.readFileSync('.github/workflows/deploy-cloudflare-pages.yml', 'utf8');
const guardStart = workflow.indexOf('      - name: Refuse non-main deployment');
const prepareStart = workflow.indexOf('      - name: Prepare Cloudflare Pages bundle');
const deployStart = workflow.indexOf('      - name: Create Pages project if needed and deploy');

assert.ok(guardStart >= 0, 'Production deployment must have an explicit non-main branch guard');
assert.ok(prepareStart > guardStart, 'Branch guard must run before preparing a deployment bundle');
assert.ok(deployStart > guardStart, 'Branch guard must run before any deployment step');

const guard = workflow.slice(guardStart, prepareStart);
assert.match(guard, /if: github\.ref != 'refs\/heads\/main'/,
  'The guard must reject every ref other than refs/heads/main');
assert.match(guard, /echo "::error::Production deployment is only allowed from the main branch\."/,
  'A rejected deployment must explain the branch restriction');
assert.match(guard, /exit 1/,
  'A rejected deployment must fail the workflow rather than continue');

const deploy = workflow.slice(deployStart);
assert.match(deploy, /wrangler@4 pages deploy dist --project-name=luna-studio --branch=main/,
  'The approved production target must remain the main Pages branch');


const workerWorkflow = fs.readFileSync('.github/workflows/deploy-worker.yml', 'utf8');
const workerCheckout = workerWorkflow.indexOf('      - name: Checkout repository');
const workerGuard = workerWorkflow.indexOf('      - name: Refuse non-main Worker deployment');
const workerDeploy = workerWorkflow.indexOf('      - name: Deploy existing LUNA Worker to Cloudflare');
assert.ok(workerCheckout >= 0 && workerGuard > workerCheckout,
  'Worker deployment must have a branch guard after checkout');
assert.ok(workerDeploy > workerGuard,
  'Worker branch guard must run before the Wrangler deployment action');
const workerGuardBlock = workerWorkflow.slice(workerGuard, workerDeploy);
assert.ok(workerGuardBlock.includes("if: github.ref != 'refs/heads/main'"),
  'Worker deployment must reject every ref other than refs/heads/main');
assert.match(workerGuardBlock, /exit 1/,
  'A rejected Worker deployment must fail before Wrangler runs');

console.log('Cloudflare production branch guard: PASS');
