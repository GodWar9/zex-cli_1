# @zex/core

Core orchestration library for [zex](https://www.npmjs.com/package/zex) — agent
orchestration, LLM provider adapters, multi-key pooling, budget management, and
security scanning. Framework-agnostic; the `zex` CLI is one consumer of it.

> **Ships as raw TypeScript, not compiled JS.** Requires Node.js **>= 22.6.0**
> (native TypeScript type-stripping). On older Node, run with
> `NODE_OPTIONS=--experimental-strip-types`. This is a deliberate, currently
> experimental packaging choice — see "Stability" below.

## Install

```bash
npm install @zex/core
```

## Quickstart

```ts
import { ZexOrchestrator } from "@zex/core";

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
import { registerEnterpriseProvider, KeyPool } from "@zex/core";

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

The only supported entrypoint is the package root (`import ... from "@zex/core"`),
documented inline in [`src/index.ts`](./src/index.ts):

- `ZexOrchestrator` (alias `ZexLLMOrchestrator`) — `new ZexOrchestrator(config)`, `.queueTask()`, `.getHealth()`, `.getTaskResult()`, `.destroy()`
- `KeyPool` — multi-provider API key pooling, quota tracking, cooldown/backoff
- `OpenAIProvider` / `AnthropicProvider` / `GeminiProvider` / `registerEnterpriseProvider`
- `CostCalculator`, `AdvancedTokenizer`
- `loadConfig`, `reloadConfig`, `detectProvider`
- `scanCode` — pattern-based security scanner (XSS/SQLi/secrets)

Everything under a deep subpath (e.g. `@zex/core/agent/runner.ts`) is exported
for the `zex` CLI's own internal use and is **not** part of the stable public
API — it may change or move without a semver-major bump.

## Stability

This is `0.x` — expect breaking changes. Most likely to change:
- The deep-subpath internal exports (see above)
- `KeyPool`'s exact quota-object shape
- Raw-TypeScript-source distribution (may move to a compiled `dist/` build in
  a future major version once the wider ecosystem's minimum-Node-version
  requirements settle)
