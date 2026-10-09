import test from 'node:test';
import assert from 'node:assert/strict';
import { getProvider } from './packages/core/src/agent/providers/index.ts';
import type { ProviderId } from './packages/core/src/agent/types.ts';

for (const [provider, hostname, keyHeader] of [
  ['openai', 'api.openai.com', 'authorization'],
  ['anthropic', 'api.anthropic.com', 'x-api-key'],
  ['gemini', 'generativelanguage.googleapis.com', 'x-goog-api-key'],
  ['openrouter', 'openrouter.ai', 'authorization'],
  ['ollama', 'localhost', 'authorization'],
] as const) {
  test(provider + ' terminal sends credentials to its own endpoint and reports rejection', async t => {
    const calls: { host: string; key: string | null }[] = [];
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      calls.push({ host: new URL(request.url).hostname, key: request.headers.get(keyHeader) });
      return new Response(JSON.stringify({ error: { message: 'Rejected test credential', type: 'authentication_error', code: 401 } }), { status: 401, statusText: 'Unauthorized', headers: { 'content-type': 'application/json' } });
    });
    const chunks = [];
    for await (const chunk of getProvider(provider).stream([{ role: 'user', content: 'hello' }], { provider, model: 'test-model', apiKey: 'synthetic-terminal-key' })) chunks.push(chunk);
    assert.ok(calls.length > 0);
    assert.ok(calls.every(call => call.host === hostname));
    assert.ok(calls.every(call => call.key === (keyHeader === 'authorization' ? 'Bearer synthetic-terminal-key' : 'synthetic-terminal-key')));
    assert.ok(chunks.some(chunk => chunk.type === 'error'));
    assert.ok(!chunks.some(chunk => chunk.type === 'delta'));
  });
}
test('compatible terminal endpoint uses the explicit URL and key', async t => {
  let captured: Request | undefined;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    captured = input instanceof Request ? input : new Request(String(input), init);
    return new Response(JSON.stringify({ error: { message: 'Rejected' } }), { status: 401, headers: { 'content-type': 'application/json' } });
  });
  const provider: ProviderId = 'openai';
  for await (const _ of getProvider(provider).stream([{ role: 'user', content: 'hello' }], { provider, model: 'custom-model', baseUrl: 'https://compatible.example/v1', apiKey: 'compatible-test-key' })) { /* drain */ }
  assert.equal(captured?.url, 'https://compatible.example/v1/chat/completions');
  assert.equal(captured?.headers.get('authorization'), 'Bearer compatible-test-key');
});

