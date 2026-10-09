import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.env.npm_execpath;
assert.ok(npm, 'Run this check through npm run test:package');
mkdirSync(join(root, '.release'), { recursive: true });
const workspace = mkdtempSync(join(tmpdir(), 'zex-package-check-'));
const consumer = join(workspace, 'consumer');
mkdirSync(consumer);
function run(args, cwd = root) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, `${args.join(' ')} failed: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
run([npm, 'run', 'build:packages']);
const tarballs = [];
for (const name of ['@sahil/zex-core', '@sahil/zex']) {
  const [pack] = JSON.parse(run([npm, 'pack', '--ignore-scripts', '--json', '--workspace', name, '--pack-destination', workspace]));
  assert.equal(pack.name, name);
  assert.ok(pack.files.some((file) => file.path === 'LICENSE'));
  assert.ok(pack.files.some((file) => file.path === (name.endsWith('core') ? 'dist/index.js' : 'dist/cli.js')));
  assert.ok(!pack.files.some((file) => /(^|\/)(\.env(?:\.|$)|node_modules|tests?)(\/|$)/.test(file.path)));
  tarballs.push(join(workspace, pack.filename));
  copyFileSync(join(workspace, pack.filename), join(root, '.release', pack.filename));
}
writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
run([npm, 'install', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund', ...tarballs], consumer);
run(['--input-type=module', '-e', "import { ZexOrchestrator } from '@sahil/zex-core'; if(typeof ZexOrchestrator !== 'function') process.exit(1)"], consumer);
const cli = join(consumer, 'node_modules', '@sahil', 'zex', 'dist', 'cli.js');
assert.match(run([cli, '--version'], consumer), /zex v\d+\.\d+\.\d+/);
assert.match(run([cli, '--help'], consumer), /Usage:/);

const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const token = randomBytes(32).toString('hex');
const env = { ...process.env, PORT: String(port), ZEX_HOST: '127.0.0.1', ZEX_AUTH_TOKEN: token, ZEX_AUTH_REQUIRED: 'true' };
for (const key of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GEMINI_API_KEYS']) delete env[key];
const child = spawn(process.execPath, [cli, '--serve'], { cwd: consumer, env, stdio: 'pipe' });
let logs = '';
child.stdout.on('data', (chunk) => { logs = (logs + chunk).slice(-8000); });
child.stderr.on('data', (chunk) => { logs = (logs + chunk).slice(-8000); });
try {
  let ready = false;
  const origin = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`${origin}/v1/health`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(1000) });
      if (response.status === 200) { ready = true; break; }
    } catch { /* Wait for the process to bind its listener. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, `Packaged server failed to start: ${logs}`);
  assert.equal((await fetch(`${origin}/v1/health`)).status, 401);
  assert.equal((await fetch(`${origin}/v1/chat`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}' })).status, 400);
  for (const body of ['null', '[]', '{', JSON.stringify({ prompt: ' ' }), JSON.stringify({ prompt: 'hi', priority: -1 }), JSON.stringify({ prompt: 'hi', model: {} })]) {
    assert.equal((await fetch(`${origin}/v1/chat`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body })).status, 400);
  }
  assert.equal((await fetch(`${origin}/v1/chat`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ prompt: 'x'.repeat(1024 * 1024) }) })).status, 413);
} finally {
  if (child.exitCode === null) { child.kill(); await once(child, 'exit'); }
}
const unsafe = { ...env, ZEX_HOST: '0.0.0.0' };
delete unsafe.ZEX_AUTH_TOKEN;
const refused = spawnSync(process.execPath, [cli, '--serve'], { cwd: consumer, env: unsafe, encoding: 'utf8', timeout: 10_000 });
assert.notEqual(refused.status, 0);
assert.match(refused.stderr, /ZEX_AUTH_TOKEN is required/);
for (const override of [{ ZEX_HOST: '127.0.0.1', ZEX_AUTH_TOKEN: '' }, { ZEX_AUTH_TOKEN: 'short' }, { PORT: 'invalid' }, { DAILY_BUDGET_USD: '-1' }]) {
  const result = spawnSync(process.execPath, [cli, '--serve'], { cwd: consumer, env: { ...env, ...override }, encoding: 'utf8', timeout: 10_000 });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ZEX_AUTH_TOKEN is required|Invalid PORT|Invalid DAILY_BUDGET_USD/);
}
console.log(`PASS: packed library import, CLI help/version, HTTP auth and public-bind protection (Node ${process.versions.node})`);
console.log(`Artifacts: ${workspace}`);
