import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { WebSocket } from 'ws';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = join(root, 'dist', `zex-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`);
const version = JSON.parse(readFileSync(join(root, 'packages/cli/package.json'), 'utf8')).version;
const temporaryRoot = realpathSync(tmpdir());
const workspace = mkdtempSync(join(temporaryRoot, 'zex-binary-smoke-'));
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/^(ZEX_|OPENAI_|ANTHROPIC_|GEMINI_|GOOGLE_|OPENROUTER_)/.test(key) || ['PORT', 'DAILY_BUDGET_USD'].includes(key)) delete env[key];
}
env.ZEX_CONFIG_FILE = join(workspace, 'config.json');
writeFileSync(env.ZEX_CONFIG_FILE, JSON.stringify({ provider: 'ollama', model: 'release-test' }));
const checks = [];
function run(args, overrides = {}) {
  const result = spawnSync(binary, args, { cwd: workspace, env: { ...env, ...overrides }, encoding: 'utf8', timeout: 15_000, windowsHide: true });
  if (result.error) throw result.error;
  return result;
}
let child;
let socket;
try {
  const printed = run(['--version']);
  assert.equal(printed.status, 0); assert.equal(printed.stdout.trim(), `zex v${version}`);
  checks.push('standalone version from an empty consumer directory');
  const help = run(['--help']); assert.equal(help.status, 0); assert.match(help.stdout, /--doctor/);
  checks.push('standalone help without Node or Bun being invoked');
  const doctor = run(['--doctor']); assert.equal(doctor.status, 0);
  assert.equal(JSON.parse(doctor.stdout).liveConnectionTested, false);
  checks.push('offline configuration diagnosis does not call a provider');
  for (const overrides of [{ ZEX_HOST: '127.0.0.1' }, { ZEX_HOST: '0.0.0.0', ZEX_AUTH_TOKEN: 'short' }]) {
    const refused = run(['--serve'], overrides);
    assert.notEqual(refused.status, 0); assert.match(refused.stderr, /ZEX_AUTH_TOKEN/);
  }
  checks.push('server refuses missing and weak authentication tokens');
  const token = randomBytes(32).toString('hex');
  child = spawn(binary, ['--serve'], { cwd: workspace, env: { ...env, ZEX_HOST: '127.0.0.1', PORT: '0', ZEX_AUTH_TOKEN: token }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let logs = ''; let spawnError;
  child.on('error', error => { spawnError = error; });
  child.stdout.on('data', chunk => { logs = (logs + chunk).slice(-16000); });
  child.stderr.on('data', chunk => { logs = (logs + chunk).slice(-16000); });
  let origin;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) break;
    const match = logs.match(/Running on http:\/\/localhost:(\d+)/);
    if (match) { origin = `http://127.0.0.1:${match[1]}`; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(origin, 'The compiled server must bind an ephemeral loopback port');
  const headers = { authorization: `Bearer ${token}` };
  assert.equal((await fetch(`${origin}/v1/health`, { signal: AbortSignal.timeout(5000) })).status, 401);
  assert.equal((await fetch(`${origin}/v1/health`, { headers, signal: AbortSignal.timeout(5000) })).status, 200);
  assert.equal((await fetch(`${origin}/v1/chat`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: 'null', signal: AbortSignal.timeout(5000) })).status, 400);
  checks.push('compiled HTTP server starts, enforces authentication and rejects malformed requests');
  socket = new WebSocket(origin.replace('http:', 'ws:') + '/v1/ws/release-smoke', { headers, handshakeTimeout: 5000 });
  const [message] = await Promise.race([once(socket, 'message'), new Promise((_, reject) => setTimeout(() => reject(new Error('Compiled WebSocket handshake timed out')), 6000).unref())]);
  assert.equal(JSON.parse(message.toString()).type, 'status');
  checks.push('compiled WebSocket server accepts authenticated sessions');
  socket.close(); await once(socket, 'close'); socket = undefined;
  assert.ok(!logs.includes(token), 'Authentication tokens must not be logged');
  const manifest = { schemaVersion: 1, version, platform: process.platform, arch: process.arch, sha256: createHash('sha256').update(readFileSync(binary)).digest('hex'), checkedAt: new Date().toISOString(), providerGenerationTested: false, checks };
  mkdirSync(join(root, '.release'), { recursive: true });
  writeFileSync(join(root, '.release', `binary-check-${process.platform}-${process.arch}.json`), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`PASS: ${checks.length} standalone executable checks (${process.platform}/${process.arch}); no model generation or paid API calls.`);
} finally {
  socket?.terminate();
  if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); }
  // Delete only the exact directory this process created beneath the real temp root.
  assert.equal(dirname(workspace), temporaryRoot); assert.ok(basename(workspace).startsWith('zex-binary-smoke-'));
  rmSync(workspace, { recursive: true, force: true });
}
