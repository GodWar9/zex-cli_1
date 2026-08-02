import test, { type TestFn } from "node:test";
import assert from "node:assert/strict";
import {
  AnthropicProvider,
  GeminiProvider,
  OpenAIProvider,
  type IEnterpriseProvider,
} from "./packages/core/src/llm/providers.ts";

const liveEnabled = process.env.ZEX_LIVE_INTEGRATION === "true";

// A provider's live test is skipped (not failed) when either the whole
// live-integration run is off, or specifically when that provider's own
// key isn't configured — so a partially-configured setup (e.g. only
// OPENAI_API_KEY set) doesn't perpetually fail the other two providers'
// tests every night. A key that IS present but invalid/expired should
// still fail loudly, since that's a real problem worth surfacing.
function maybeTest(name: string, apiKeyEnvVar: string, fn: TestFn) {
  const hasKey = Boolean(process.env[apiKeyEnvVar]);
  const skipReason = !liveEnabled
    ? "Set ZEX_LIVE_INTEGRATION=true and provider API keys to run live adapter checks."
    : !hasKey
      ? `Skipped — ${apiKeyEnvVar} is not configured.`
      : false;
  test(name, { skip: skipReason }, fn);
}

async function assertProviderWorks(provider: IEnterpriseProvider, model: string) {
  const response = await provider.chat(
    [
      { role: "system", content: "Reply with a short factual sentence." },
      { role: "user", content: "Say exactly one sentence about reliable software tests." },
    ],
    { model, maxTokens: 48, temperature: 0 },
  );

  assert.equal(typeof response.text, "string");
  assert.ok(response.text.trim().length > 0);
  assert.equal(response.model, model);
  assert.ok(response.usage.prompt_tokens >= 0);
  assert.ok(response.usage.completion_tokens >= 0);
}

maybeTest("OpenAI adapter reaches the live API", "OPENAI_API_KEY", async () => {
  const key = process.env.OPENAI_API_KEY;
  assert.ok(key, "OPENAI_API_KEY is required");
  await assertProviderWorks(new OpenAIProvider(key), process.env.OPENAI_TEST_MODEL ?? "gpt-4o-mini");
});

maybeTest("Anthropic adapter reaches the live API", "ANTHROPIC_API_KEY", async () => {
  const key = process.env.ANTHROPIC_API_KEY;
  assert.ok(key, "ANTHROPIC_API_KEY is required");
  await assertProviderWorks(new AnthropicProvider(key), process.env.ANTHROPIC_TEST_MODEL ?? "claude-3-haiku-20240307");
});

maybeTest("Gemini adapter reaches the live API", "GEMINI_API_KEY", async () => {
  const key = process.env.GEMINI_API_KEY;
  assert.ok(key, "GEMINI_API_KEY is required");
  await assertProviderWorks(new GeminiProvider(key), process.env.GEMINI_TEST_MODEL ?? "gemini-2.0-flash");
});
