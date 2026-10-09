# @sahil/zex-core

> Release status (2026-10-08): scoped packages are prepared and locally tested, but not yet published. Registry installation commands below apply after publication.

Core orchestration library for [zex](https://github.com/GodWar9/zex-cli_1) — agent
orchestration, LLM provider adapters, multi-key pooling, budget management, and
security scanning. Framework-agnostic; the `zex` CLI is one consumer of it.

> `import { ... } from "@sahil/zex-core"` resolves to compiled JS (`dist/`), built
> via `tsc`. Requires Node.js **>= 24.12.0**. Deep subpath imports (e.g.
> `@sahil/zex-core/agent/runner.ts`) still resolve to raw TypeScript source — those
> are for the `zex` CLI's own bundler-time use, not meant to be `require`d /
> `import`ed directly by Node at runtime. See "Stability" below.

## Install

```bash
npm install @sahil/zex-core
```

## Quickstart

```ts
import { ZexOrchestrator } from "@sahil/zex-core";

const orchestrator = new ZexOrchestrator({
  keys: [
    { provider: "openai", apiKey: process.env.OPENAI_API_KEY! },
    { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY! },
  ],
  dailyBudgetUSD: 5,
});

const taskId = await orchestrator.queueTask("Explain event loops", {
  model: "gpt-4o-mini",
});

console.log(orchestrator.getHealth());
```

## Adding a custom provider

The key pool and provider factory are provider-agnostic — you're not limited
to the three built-in providers:

```ts
import { registerEnterpriseProvider, KeyPool } from "@sahil/zex-core";

class MySelfHostedProvider {
  constructor(private apiKey: string) {}
  async chat(messages, options) { /* ... */ }
}

registerEnterpriseProvider("my-self-hosted-llm", MySelfHostedProvider);

// Give it real quota limits instead of the generic fallback
KeyPool.registerQuotaDefault("my-self-hosted-llm", {
  dailyLimit: 10_000_000,
  hourlyLimit: 1_000_000,
  requestsPerMinute: 1000,
});
```

## API reference

The only supported entrypoint is the package root (`import ... from "@sahil/zex-core"`),
documented inline in [`src/index.ts`](./src/index.ts):

- `ZexOrchestrator` (alias `ZexLLMOrchestrator`) — `new ZexOrchestrator(config)`, `.queueTask()`, `.getHealth()`, `.getTaskResult()`, `.destroy()`
- `KeyPool` — multi-provider API key pooling, quota tracking, cooldown/backoff
- `OpenAIProvider` / `AnthropicProvider` / `GeminiProvider` / `registerEnterpriseProvider`
- `CostCalculator`, `AdvancedTokenizer`
- `loadConfig`, `reloadConfig`, `detectProvider`
- `scanCode` — pattern-based security scanner (XSS/SQLi/secrets)

Everything under a deep subpath (e.g. `@sahil/zex-core/agent/runner.ts`) is exported
for the `zex` CLI's own internal use and is **not** part of the stable public
API — it may change or move without a semver-major bump.

## Stability

This is `0.x` — expect breaking changes. Most likely to change:
- The deep-subpath internal exports (see above) — raw source, no compiled/typed
  contract, may move or change shape without a semver-major bump
- `KeyPool`'s exact quota-object shape
- The compiled-output build pipeline itself (currently plain `tsc`; may adopt
  bundling/minification in a future minor version)

See the [user guide](https://github.com/GodWar9/zex-cli_1/blob/main/packages/cli/USER_GUIDE.md) for provider setup and terminal/server differences.
