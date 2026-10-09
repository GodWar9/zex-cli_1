import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from './packages/core/src/config/resolve.ts';
import { getKeyPool } from './packages/core/src/agent/providers/gemini.ts';
import { routeModel } from './packages/core/src/llm/routing.ts';
import { ZexLLMOrchestrator } from './packages/core/src/llm/orchestrator.ts';
import { registerEnterpriseProvider } from './packages/core/src/llm/providers.ts';

test('explicit provider gets its own model regardless of other provider keys', () => {
  const config = resolveConfig({ provider: 'anthropic' }, { GEMINI_API_KEY: 'gemini-fixture' });
  assert.equal(config.provider.provider, 'anthropic');
  assert.match(config.provider.model, /^claude-/);
  assert.equal(config.provider.apiKey, undefined);
});
test('environment overrides config and keeps credentials paired with provider', () => {
  const config = resolveConfig({ provider: 'gemini', model: 'saved-model' }, { ZEX_PROVIDER: 'openai', ZEX_MODEL: 'chosen-model', OPENAI_API_KEY: 'openai-fixture' });
  assert.equal(config.provider.provider, 'openai');
  assert.equal(config.provider.model, 'chosen-model');
  assert.equal(config.provider.apiKey, 'openai-fixture');
});
test('explicit key beats provider environment keys and pool', () => {
  const config = resolveConfig({ provider: 'gemini', apiKey: 'explicit-key' }, { GEMINI_API_KEYS: 'env-a,env-b', GEMINI_API_KEY: 'env-c' });
  assert.equal(getKeyPool(config.provider).getCurrentKey(), 'explicit-key');
});
test('switching provider does not forward saved credentials, model or endpoint', () => {
  const config = resolveConfig({ provider: 'openai', apiKey: 'saved-secret', model: 'saved-model', baseUrl: 'https://saved.example/v1' }, { ZEX_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'correct-key' });
  assert.equal(config.provider.apiKey, 'correct-key');
  assert.match(config.provider.model, /^claude-/);
  assert.equal(config.provider.baseUrl, undefined);
});
test('configured Gemini pool survives loading and key rotation', () => {
  const config = resolveConfig({ provider: 'gemini', apiKeys: ['pool-a', 'pool-b'] }, { GEMINI_API_KEY: 'env-key' });
  const pool = getKeyPool(config.provider);
  assert.equal(pool.getCurrentKey(), 'pool-a');
  assert.equal(pool.markExhausted('pool-a'), 'pool-b');
  assert.equal(getKeyPool(config.provider), pool);
  const replacement = resolveConfig({ provider: 'gemini', apiKey: 'replacement' }, {});
  assert.equal(getKeyPool(replacement.provider).getCurrentKey(), 'replacement');
});
test('environment Gemini pool wins over environment single key', () => {
  const config = resolveConfig({}, { GEMINI_API_KEYS: ' a, ,b ', GOOGLE_API_KEY: 'single' });
  assert.deepEqual(config.provider.apiKeys, ['a', 'b']);
  assert.equal(config.provider.apiKey, undefined);
});
test('invalid configuration fails without echoing secret values', () => {
  for (const input of [null, [], { provider: 'secret-invalid-provider' }, { apiKeys: [''] }, { apiKey: 42 }, { maxTokens: 0 }, { temperature: '1' }]) {
    assert.throws(() => resolveConfig(input, {}), error => error instanceof Error && !error.message.includes('secret-invalid-provider'));
  }
});
test('compatible endpoints allow HTTPS and local HTTP but reject credential URLs', () => {
  for (const baseUrl of ['https://example.test/v1', 'http://127.0.0.1:11434/v1']) {
    assert.equal(resolveConfig({ provider: 'openai', baseUrl }, {}).provider.baseUrl, baseUrl);
  }
  for (const baseUrl of ['http://remote.test/v1', 'https://user:secret@example.test', 'file:///tmp/test', 'https://example.test?key=secret']) {
    assert.throws(() => resolveConfig({ provider: 'openai', baseUrl }, {}));
  }
  assert.throws(() => resolveConfig({ provider: 'gemini', baseUrl: 'https://example.test' }, {}));
});
test('Ollama setup has a local model default and does not need a key', () => {
  const config = resolveConfig({ provider: 'ollama' }, {});
  assert.equal(config.provider.model, 'llama3.2');
  assert.equal(config.provider.apiKey, undefined);
});
test('headless requests choose models for their configured provider', () => {
  assert.deepEqual(routeModel([{ provider: 'gemini' }]), { provider: 'gemini', model: 'gemini-2.5-flash' });
  assert.deepEqual(routeModel([{ provider: 'openai' }, { provider: 'anthropic' }], 'claude-example'), { provider: 'anthropic', model: 'claude-example' });
  assert.throws(() => routeModel([{ provider: 'openai' }], 'gemini-example'));
  assert.throws(() => routeModel([{ provider: 'openai' }, { provider: 'anthropic' }], 'custom-model'));
  assert.throws(() => routeModel([{ provider: 'openai' }], 'claude-example', 'openai'));
  assert.throws(() => routeModel([]));
});
test('mixed-provider scheduler cannot send a Gemini model through an OpenAI key', async () => {
  const calls: string[] = [];
  for (const name of ['openai', 'gemini']) {
    registerEnterpriseProvider(name, class {
      constructor(key: string) { calls.push(name + ':' + key); }
      async chat(_messages: unknown, options: { model: string }) {
        calls.push(options.model);
        return { text: 'test response', model: options.model, usage: { prompt_tokens: 1, completion_tokens: 1 } };
      }
    });
  }
  const orchestrator = new ZexLLMOrchestrator({
    keys: [{ provider: 'openai', apiKey: 'openai-fixture', priority: 10 }, { provider: 'gemini', apiKey: 'gemini-fixture', priority: 1 }],
    dailyBudgetUSD: 10,
  });
  try {
    const id = await orchestrator.queueTask('hello', { model: 'gemini-2.5-flash' });
    await orchestrator.runScheduler();
    for (let i = 0; i < 50 && orchestrator.getTaskResult(id).status !== 'completed'; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(orchestrator.getTaskResult(id).status, 'completed');
    assert.deepEqual(calls, ['gemini:gemini-fixture', 'gemini-2.5-flash']);
  } finally { orchestrator.destroy(); }
});
