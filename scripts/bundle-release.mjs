import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, 'Git release identity is unavailable'); return result.stdout.trim();
}
assert.equal(git(['status', '--porcelain', '--untracked-files=normal']), '', 'Commit source changes before preparing a release');
const cliPackage = JSON.parse(readFileSync(join(root, 'packages/cli/package.json'), 'utf8'));
const corePackage = JSON.parse(readFileSync(join(root, 'packages/core/package.json'), 'utf8'));
const version = cliPackage.version;
const packageFilename = pkg => `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
const name = `zex-${version}-${process.platform}-${process.arch}`;
const release = join(root, '.release'); mkdirSync(release, { recursive: true });
const stage = mkdtempSync(join(release, 'bundle-'));
const binaryName = `zex-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`;
const files = [
  ['dist/' + binaryName, binaryName],
  [`.release/${packageFilename(corePackage)}`, packageFilename(corePackage)],
  [`.release/${packageFilename(cliPackage)}`, packageFilename(cliPackage)],
  ['packages/cli/USER_GUIDE.md', 'USER_GUIDE.md'],
  ['LICENSE', 'LICENSE'],
  ['RELEASE_INSTALL.md', 'README.md'],
  [`.release/binary-check-${process.platform}-${process.arch}.json`, 'binary-check.json'],
];
const entries = [];
for (const [source, destination] of files) {
  assert.equal(basename(destination), destination, 'Release members must not contain paths');
  const sourcePath = join(root, source); assert.ok(statSync(sourcePath).isFile());
  const bytes = readFileSync(sourcePath); copyFileSync(sourcePath, join(stage, destination));
  entries.push({ file: destination, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const binaryCheck = JSON.parse(readFileSync(join(stage, 'binary-check.json'), 'utf8'));
assert.equal(binaryCheck.sha256, entries.find(entry => entry.file === binaryName).sha256, 'The binary changed after acceptance checks; rerun test:binary');
assert.equal(binaryCheck.version, version);
const receiptPath = join(release, 'npm-publication.json');
const receipt = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')) : null;
const registryPublished = receipt?.published === true && [corePackage, cliPackage].every(pkg => {
  const artifact = receipt.packages?.find(entry => entry.name === pkg.name && entry.version === pkg.version);
  return artifact && artifact.sha256 === entries.find(entry => entry.file === packageFilename(pkg)).sha256;
});
const manifest = { schemaVersion: 1, version, sourceCommit: git(['rev-parse', 'HEAD']), platform: process.platform, arch: process.arch, createdAt: new Date().toISOString(), distribution: 'standalone executable and npm tarballs', registryPublished, providerGenerationTested: false, files: entries };
writeFileSync(join(stage, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const members = [...entries.map(entry => entry.file), 'release-manifest.json'];
const archive = join(release, name + '.tar.gz');
const result = spawnSync('tar', ['-czf', archive, '-C', stage, ...members], { cwd: root, encoding: 'utf8', windowsHide: true });
assert.equal(result.status, 0, 'Could not archive the release with the system tar utility');
const listing = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8', windowsHide: true });
assert.equal(listing.status, 0);
assert.deepEqual(listing.stdout.trim().split(/\r?\n/).sort(), members.slice().sort(), 'The archive must contain exactly the reviewed allowlist');
const extracted = mkdtempSync(join(release, 'verify-'));
const unpack = spawnSync('tar', ['-xzf', archive, '-C', extracted], { encoding: 'utf8', windowsHide: true });
assert.equal(unpack.status, 0, 'Release extraction failed');
for (const entry of entries) assert.equal(createHash('sha256').update(readFileSync(join(extracted, entry.file))).digest('hex'), entry.sha256, 'An extracted release member changed');
const launch = spawnSync(join(extracted, binaryName), ['--version'], { cwd: extracted, encoding: 'utf8', timeout: 15000, windowsHide: true });
assert.equal(launch.status, 0); assert.equal(launch.stdout.trim(), `zex v${version}`);
const digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
writeFileSync(archive + '.sha256', `${digest}  ${basename(archive)}\n`);
writeFileSync(join(release, name + '.json'), JSON.stringify({ ...manifest, archiveSha256: digest }, null, 2) + '\n');
for (const directory of [stage, extracted]) {
  assert.equal(dirname(realpathSync(directory)), realpathSync(release));
  assert.match(basename(directory), /^(bundle|verify)-/);
  rmSync(directory, { recursive: true, force: true });
}
console.log(`Prepared ${basename(archive)} and its SHA-256 checksum. Source ${manifest.sourceCommit.slice(0, 12)}. Registry publication remains separate.`);
