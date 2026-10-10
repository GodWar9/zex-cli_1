import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openAIResponse, anthropicResponse } from './tests/provider-stream-fixtures.ts';

test('real runner preserves tool execution and denial across terminal providers', async t => {
  const root = mkdtempSync(join(os.tmpdir(), 'zex-tool-loop-'));
  const originalCwd = process.cwd();
  const originalEnv = { ...process.env };
  mkdirSync(join(root, 'home'));
  mkdirSync(join(root, 'project'));
  mkdirSync(join(root, 'project-sibling'));
  t.mock.method(os, 'homedir', () => join(root, 'home'));
  syncBuiltinESMExports();
  process.chdir(join(root, 'project'));
  process.env.ZEX_CONFIG_FILE = join(root, 'config.json');
  for (const name of ['ZEX_PROVIDER', 'ZEX_MODEL', 'ZEX_API_KEY', 'ZEX_BASE_URL']) delete process.env[name];
  t.after(() => {
    process.chdir(originalCwd);
    for (const name of ['ZEX_CONFIG_FILE', 'ZEX_PROVIDER', 'ZEX_MODEL', 'ZEX_API_KEY', 'ZEX_BASE_URL']) {
      if (originalEnv[name] === undefined) delete process.env[name]; else process.env[name] = originalEnv[name];
    }
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  const { runTurn } = await import('./packages/core/src/agent/runner.ts');
  const { reloadConfig } = await import('./packages/core/src/config/index.ts');
  const { dualCache } = await import('./packages/core/src/cache/index.ts');
  const { validateWorkspaceBoundary } = await import('./packages/core/src/utils/fs-guard.ts');
  await assert.rejects(validateWorkspaceBoundary('../project-sibling/escaped.txt'), /escapes/);
  const { writeFileTool } = await import('./packages/core/src/tools/write_file.ts');
  const escaped = await writeFileTool.execute({ path: '../project-sibling/escaped.txt', content: 'must not exist' });
  assert.equal(escaped.isError, true);
  assert.equal(existsSync(join(root, 'project-sibling', 'escaped.txt')), false);

  for (const provider of ['openai', 'anthropic', 'openrouter', 'ollama'] as const) {
    for (const approve of [true, false]) await t.test(provider + (approve ? ' executes write/read/shell and returns results' : ' respects denied tool execution'), async sub => {
      writeFileSync(process.env.ZEX_CONFIG_FILE!, JSON.stringify({ provider, model: 'test-model', apiKey: 'synthetic-runner-key' }));
      reloadConfig();
      dualCache.clear();
      const filename = provider + '-' + approve + '.txt';
      const calls = [
        { id: 'write', name: 'write_file', json: JSON.stringify({ path: filename, content: 'verified tool round trip' }) },
        { id: 'read', name: 'read_file', json: JSON.stringify({ path: filename }) },
        { id: 'shell', name: 'run_shell_command', json: JSON.stringify({ command: 'echo zex-tool-smoke' }) },
      ];
      let requestCount = 0;
      const requests: any[] = [];
      sub.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(String(input), init);
        requests.push(JSON.parse(await request.text()));
        requestCount++;
        assert.ok(requestCount <= 2, 'Unexpected provider call');
        const make = provider === 'anthropic' ? anthropicResponse : openAIResponse;
        return requestCount === 1 ? make(calls) : make();
      });
      const approvals: string[] = [];
      const errors: string[] = [];
      const results: string[] = [];
      let done = false;
      const history = await runTurn([], 'do work', {
        onDelta: () => {},
        onUsage: (input, output) => { assert.equal(input, 22); assert.equal(output, 14); },
        onError: message => errors.push(message),
        onDone: () => { done = true; },
        onToolCall: async name => { approvals.push(name); return approve; },
        onToolResult: (_name, result, failed) => { assert.ok(!failed, result); results.push(result); },
      });
      assert.deepEqual(errors, []);
      assert.ok(done);
      assert.equal(requestCount, 2);
      assert.deepEqual(approvals, ['write_file', 'read_file', 'run_shell_command']);
      assert.equal(history.at(-1)?.content, 'Complete');
      assert.equal(existsSync(filename), approve);
      if (approve) {
        assert.equal(readFileSync(filename, 'utf8'), 'verified tool round trip');
        assert.ok(results.some(value => value.includes('zex-tool-smoke')));
        assert.ok(JSON.stringify(requests[1].messages).includes('verified tool round trip'));
      } else {
        assert.ok(history.filter(m => m.role === 'tool').every(m => m.content.includes('User denied')));
        assert.equal(results.length, 0);
      }
    });
  }
});

