import test from 'node:test';
import assert from 'node:assert/strict';
import { getProvider } from './packages/core/src/agent/providers/index.ts';
import { ToolCallBuffer } from './packages/core/src/agent/providers/tool-calls.ts';
import type { ConversationMessage, ProviderId, StreamChunk } from './packages/core/src/agent/types.ts';
import { openAIResponse, anthropicResponse, type Call } from './tests/provider-stream-fixtures.ts';
const calls: Call[] = [
  { id: 'call-write', name: 'write_file', json: JSON.stringify({ path: 'example.txt', content: 'café 🌍' }) },
  { id: 'call-shell', name: 'run_shell_command', json: JSON.stringify({ command: 'echo test' }) },
];
async function collect(provider: ProviderId, messages: ConversationMessage[], tools = true) {
  const result: StreamChunk[] = [];
  for await (const chunk of getProvider(provider).stream(messages, { provider, model: 'test-model', apiKey: 'synthetic-fixture', tools })) result.push(chunk);
  return result;
}
for (const provider of ['openai', 'openrouter', 'ollama', 'anthropic'] as const) {
  const response = provider === 'anthropic' ? anthropicResponse : openAIResponse;
  test(provider + ': fragmented parallel calls round-trip with matching IDs and final usage', async t => {
    const requests: any[] = [];
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      requests.push(JSON.parse(await request.text()));
      return requests.length === 1 ? response(calls) : response();
    });
    const history: ConversationMessage[] = [{ role: 'system', content: 'Project instruction' }, { role: 'user', content: 'Update the project' }];
    const first = await collect(provider, history);
    const returned = first.filter(chunk => chunk.type === 'tool_call').map(chunk => chunk.toolCall);
    assert.deepEqual(returned, calls.map(call => ({ id: call.id, name: call.name, args: JSON.parse(call.json) })));
    assert.deepEqual(first.find(chunk => chunk.type === 'usage'), { type: 'usage', inputTokens: 11, outputTokens: 7 });
    assert.equal(first.at(-1)?.type, 'done');
    assert.ok(requests[0].tools.some((tool: any) => (tool.function?.name ?? tool.name) === 'write_file'));
    const second = await collect(provider, [...history, { role: 'assistant', content: '', toolCalls: returned }, ...returned.map(tc => ({ role: 'tool' as const, content: 'Executed ' + tc.name, name: tc.name, toolCallId: tc.id }))]);
    assert.ok(second.some(chunk => chunk.type === 'delta' && chunk.text === 'Complete'));
    const outgoing = requests[1].messages;
    if (provider === 'anthropic') {
      assert.match(requests[1].system, /Project instruction/);
      assert.deepEqual(outgoing.at(-1).content.map((block: any) => block.tool_use_id), ['call-write', 'call-shell']);
      assert.equal(outgoing.at(-2).content[0].type, 'tool_use');
    } else {
      assert.match(outgoing[0].content, /Project instruction/);
      assert.deepEqual(outgoing.filter((m: any) => m.role === 'tool').map((m: any) => m.tool_call_id), ['call-write', 'call-shell']);
      assert.equal(outgoing.find((m: any) => m.role === 'assistant').tool_calls.length, 2);
    }
  });
  for (const mode of ['invalid-json', 'array-args', 'duplicate-id', 'truncated', 'missing-stop', 'disabled'] as const) {
    test(provider + ': refuses ' + mode + ' without emitting executable calls', async t => {
      const batch = calls.map(call => ({ ...call }));
      if (mode === 'invalid-json') batch[1]!.json = '{';
      if (mode === 'array-args') batch[1]!.json = '[]';
      if (mode === 'duplicate-id') batch[1]!.id = batch[0]!.id;
      t.mock.method(globalThis, 'fetch', async () => response(batch, { incomplete: mode === 'missing-stop', ...(mode === 'truncated' ? { finish: provider === 'anthropic' ? 'max_tokens' : 'length' } : {}) }));
      const chunks = await collect(provider, [{ role: 'user', content: 'test' }], mode !== 'disabled');
      assert.ok(chunks.some(chunk => chunk.type === 'error'));
      assert.ok(!chunks.some(chunk => chunk.type === 'tool_call'));
      assert.ok(!chunks.some(chunk => chunk.type === 'done'));
    });
  }
  test(provider + ': text-only mode omits tool schemas', async t => {
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(String(input), init);
      assert.equal(JSON.parse(await req.text()).tools, undefined);
      return response();
    });
    const chunks = await collect(provider, [{ role: 'user', content: 'test' }], false);
    assert.equal(chunks.at(-1)?.type, 'done');
  });
}
test('tool buffering bounds call count and argument size', () => {
  assert.throws(() => new ToolCallBuffer().append(64, 'id', 'write_file', '{}'));
  assert.throws(() => new ToolCallBuffer().append(0, 'id', 'write_file', 'x'.repeat(1024 * 1024)));
});

