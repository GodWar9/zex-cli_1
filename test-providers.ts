import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIProvider, AnthropicProvider, GeminiProvider } from './packages/core/src/llm/providers.ts';

const cases = [
  { name: 'OpenAI', create: () => new OpenAIProvider('sk-test'), response: {
    choices: [{ message: { content: 'Transport response' } }], usage: { prompt_tokens: 2, completion_tokens: 3 },
  } },
  { name: 'Anthropic', create: () => new AnthropicProvider('claude-test'), response: {
    content: [{ type: 'text', text: 'Transport response' }], usage: { input_tokens: 2, output_tokens: 3 },
  } },
  { name: 'Gemini', create: () => new GeminiProvider('gemini-test'), response: {
    candidates: [{ content: { role: 'model', parts: [{ text: 'Transport response' }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3 },
  } },
];

for (const entry of cases) {
  test(`${entry.name}: test-shaped credentials use the SDK transport, preserving temperature zero`, async (t) => {
    const requests: Record<string, unknown>[] = [];
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      requests.push(JSON.parse(await request.text()) as Record<string, unknown>);
      return new Response(JSON.stringify(entry.response), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const result = await entry.create().chat([{ role: 'user', content: 'Hello' }], { model: 'test-model', temperature: 0 });
    assert.equal(result.text, 'Transport response');
    assert.equal(requests.length, 1);
    const payload = requests[0]!;
    const config = payload['generationConfig'] as Record<string, unknown> | undefined;
    assert.equal(config ? config['temperature'] : payload['temperature'], 0);
  });

  test(`${entry.name}: rejected credentials fail rather than fabricate a response`, async (t) => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      return new Response(JSON.stringify({ error: { message: 'Invalid API key', type: 'authentication_error', code: 401 } }),
        { status: 401, statusText: 'Unauthorized', headers: { 'content-type': 'application/json' } });
    });
    await assert.rejects(entry.create().chat([{ role: 'user', content: 'Hello' }], { model: 'test-model' }));
    assert.ok(calls > 0);
  });
}
