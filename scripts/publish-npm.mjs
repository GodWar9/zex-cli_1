import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.env.npm_execpath;
assert.ok(npm, 'Run through npm run release:npm or release:npm:dry-run');
assert.ok(process.argv.slice(2).every(arg => ['--publish', '--dry-run'].includes(arg)), 'Unknown argument');
const publish = process.argv.includes('--publish');
assert.ok(!(publish && process.argv.includes('--dry-run')), 'Choose publish or dry-run');
const registry = 'https://registry.npmjs.org/';
const evidence = JSON.parse(readFileSync(join(root, '.release/npm-packages.json'), 'utf8'));
const packages = ['core', 'cli'].map(directory => JSON.parse(readFileSync(join(root, 'packages', directory, 'package.json'), 'utf8')));
assert.equal(evidence.packages.length, 2);
const receiptPath = join(root, '.release/npm-publication.json');
const receipt = { registry, checkedAt: new Date().toISOString(), published: false, packages: [] };
function run(args, inherit = false) {
  const result = spawnSync(process.execPath, [npm, ...args], { cwd: root, ...(inherit ? { stdio: 'inherit' } : { encoding: 'utf8' }), windowsHide: true });
  assert.equal(result.status, 0, `npm ${args[0]} failed${inherit ? '' : ': ' + result.stderr}`);
  return result.stdout?.trim();
}
function verifyArtifact(artifact, pkg) {
  assert.equal(artifact.name, pkg.name); assert.equal(artifact.version, pkg.version);
  assert.equal(basename(artifact.filename), artifact.filename);
  const bytes = readFileSync(join(root, '.release', artifact.filename));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), artifact.sha256, 'Tarball changed since acceptance checks');
  assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), artifact.integrity);
}
async function publishedVersion(artifact) {
  const response = await fetch(registry + encodeURIComponent(artifact.name) + '/' + artifact.version, { signal: AbortSignal.timeout(15000) });
  if (response.status === 404) return null;
  assert.equal(response.status, 200, `Registry returned ${response.status}`);
  return response.json();
}
for (let i = 0; i < packages.length; i++) verifyArtifact(evidence.packages[i], packages[i]);
if (publish) {
  const user = run(['whoami', '--registry=' + registry]);
  console.log(`Publishing reviewed tarballs as ${user}. npm may request browser/2FA authorization.`);
}
for (const artifact of evidence.packages) {
  const existing = await publishedVersion(artifact);
  if (existing) {
    assert.equal(existing.dist.integrity, artifact.integrity, `${artifact.name}@${artifact.version} already exists with different bytes. Bump the version; never overwrite a release.`);
    console.log(`Verified existing ${artifact.name}@${artifact.version}; skipping re-publication.`);
  } else {
    run(['publish', join(root, '.release', artifact.filename), '--ignore-scripts', '--access=public', '--tag=latest', '--registry=' + registry, ...(publish ? ['--browser=false'] : ['--dry-run'])], true);
  }
  if (publish) {
    let remote;
    for (let attempt = 0; attempt < 12; attempt++) {
      remote = await publishedVersion(artifact);
      if (remote) break;
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    assert.ok(remote, `Registry has not made ${artifact.name} available yet. Rerun to resume.`);
    assert.equal(remote.dist.integrity, artifact.integrity, 'Published bytes differ from the tested tarball');
    receipt.packages.push({ ...artifact, url: `https://www.npmjs.com/package/${artifact.name}`, verifiedAt: new Date().toISOString() });
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  }
}
if (publish) {
  receipt.published = true;
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  console.log('Both npm packages are public and their integrity matches the tested tarballs. Run npm run test:registry.');
} else console.log('Dry-run passed. No packages were published.');
