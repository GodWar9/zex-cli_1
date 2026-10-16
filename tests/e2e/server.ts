// Inject a deterministic provider only in the test process. Never contact a paid API.
for (const key of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GEMINI_API_KEYS', 'GOOGLE_API_KEY']) delete process.env[key];
process.env.OPENAI_API_KEY = 'playwright-provider-fixture';
process.env.ZEX_AUTH_TOKEN = 'playwright-transport-secret-not-for-production';
process.env.ZEX_HOST = '127.0.0.1';
process.env.PORT = '3151';
const { registerEnterpriseProvider } = await import('../../packages/core/src/llm/providers.ts');
registerEnterpriseProvider('openai', class {
  async chat(_messages: unknown, options: { model: string; onChunk?: (text: string) => void }) {
    options.onChunk?.('Deterministic test response');
    return { text: 'Deterministic test response', usage: { prompt_tokens: 10, completion_tokens: 5 }, model: options.model };
  }
});
const { shutdown } = await import('../../packages/cli/src/api/server.ts');
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { shutdown(); process.exit(); });
export {};
