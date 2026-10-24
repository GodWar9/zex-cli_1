import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.env.npm_execpath;
assert.ok(npm, 'Run through npm run test:registry');
const cliPackage = JSON.parse(readFileSync(join(root, 'packages/cli/package.json'), 'utf8'));
const corePackage = JSON.parse(readFileSync(join(root, 'packages/core/package.json'), 'utf8'));
const workspace = mkdtempSync(join(tmpdir(), 'zex-registry-check-'));
const consumer = join(workspace, 'consumer'); mkdirSync(consumer);
const prefix = join(workspace, 'global'); mkdirSync(prefix);
const registry = 'https://registry.npmjs.org/';
const env = { ...process.env, NPM_CONFIG_CACHE: join(workspace, 'cache'), NPM_CONFIG_REGISTRY: registry, NPM_CONFIG_USERCONFIG: join(workspace, 'empty.npmrc'), ZEX_CONFIG_FILE: join(workspace, 'config.json') };
for (const key of Object.keys(env)) if (/^(NODE_AUTH_TOKEN|NPM_TOKEN|ZEX_(PROVIDER|MODEL|API_KEY|BASE_URL)|OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEYS?|GOOGLE_API_KEY|OPENROUTER_API_KEY)$/i.test(key)) delete env[key];
writeFileSync(env.NPM_CONFIG_USERCONFIG, '');
writeFileSync(env.ZEX_CONFIG_FILE, JSON.stringify({ provider: 'ollama' }));
writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: consumer, env, encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(result.status, 0, `${args[0]} failed: ${result.stderr}\n${result.stdout}`);
  return result.stdout.trim();
}
try {
  const spec = `${cliPackage.name}@${cliPackage.version}`;
  // No workspace, local tarballs, existing npm cache or registry credentials.
  assert.equal(run([npm, 'exec', '--yes', '--package=' + spec, '--', 'zex', '--version']), `zex v${cliPackage.version}`);
  run([npm, 'install', '--global', '--prefix', prefix, '--ignore-scripts', '--no-audit', '--no-fund', spec]);
  const shim = process.platform === 'win32' ? join(prefix, 'zex.cmd') : join(prefix, 'bin/zex');
  const result = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${shim}" --help"`], { cwd: consumer, env, encoding: 'utf8', timeout: 15000, windowsHide: true })
    : spawnSync(shim, ['--help'], { cwd: consumer, env, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Usage:/);
  const installed = join(prefix, ...(process.platform === 'win32' ? [] : ['lib']), 'node_modules', ...cliPackage.name.split('/'), 'dist/cli.js');
  const diagnostic = JSON.parse(run([installed, '--doctor']));
  assert.equal(diagnostic.liveConnectionTested, false);
  run([npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund', `${corePackage.name}@${corePackage.version}`]);
  run(['--input-type=module', '-e', `import { ZexOrchestrator } from ${JSON.stringify(corePackage.name)}; if(typeof ZexOrchestrator !== 'function') process.exit(1)`]);
  const checks = ['fresh npx command', 'global installation and command shim', 'offline doctor', 'public library import'];
  mkdirSync(join(root, '.release'), { recursive: true });
  writeFileSync(join(root, '.release/registry-check.json'), JSON.stringify({ checkedAt: new Date().toISOString(), registry, cli: spec, core: `${corePackage.name}@${corePackage.version}`, node: process.versions.node, checks, providerGenerationTested: false }, null, 2) + '\n');
  console.log('PASS: ' + checks.join(', '));
} finally {
  assert.equal(dirname(realpathSync(workspace)), realpathSync(tmpdir()));
  assert.match(basename(workspace), /^zex-registry-check-/);
  rmSync(workspace, { recursive: true, force: true });
}
