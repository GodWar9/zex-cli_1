/**
 * @zex/core — public API
 *
 * This is the ONLY supported entrypoint for consumers doing
 * `import { ... } from "@zex/core"`. Anything not re-exported here is an
 * internal implementation detail and may change without a semver-major bump.
 *
 * Quickstart:
 *
 *   import { ZexOrchestrator } from "@zex/core";
 *
 *   const orchestrator = new ZexOrchestrator({
 *     keys: [{ provider: "openai", apiKey: process.env.OPENAI_API_KEY! }],
 *     dailyBudgetUSD: 5,
 *   });
 *
 *   const taskId = await orchestrator.queueTask("Explain event loops");
 *   console.log(orchestrator.getHealth());
 */

// ─── Orchestrator (primary entrypoint) ────────────────────────────────────
export {
  ZexLLMOrchestrator,
  ZexLLMOrchestrator as ZexOrchestrator,
  type OrchestratorConfig,
  type OrchestratorConfig as ZexOrchestratorConfig,
  TokenBudgetManager,
  LLMMonitor,
  FailureHandler,
  type TaskWithMetrics,
  type BudgetPlan,
  type LLMMetrics,
} from "./llm/orchestrator.ts";

// ─── Providers — extend with your own via registerEnterpriseProvider ──────
export {
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  LLMProviderFactory,
  registerEnterpriseProvider,
  type IEnterpriseProvider,
  type ProviderChatOptions,
  type ChatResponse,
} from "./llm/providers.ts";

// ─── Multi-key pool — provider-agnostic; see registerQuotaDefault ─────────
export {
  KeyPool,
  type ApiKeyMetadata,
  type KeyPoolConfig,
} from "./llm/keyPool.ts";

// ─── Cost + token accounting ───────────────────────────────────────────────
export { CostCalculator, type ModelCost } from "./llm/costCalculator.ts";
export {
  AdvancedTokenizer,
  type TokenEstimate,
  type TokenizerConfig,
} from "./llm/tokenizer.ts";

// ─── Config ─────────────────────────────────────────────────────────────
export {
  loadConfig,
  reloadConfig,
  getActiveModelLabel,
} from "./config/index.ts";
export type { ZexConfig, UserConfig, ProviderId } from "./config/types.ts";
export { detectProvider } from "./config/defaults.ts";

// ─── Security scanning ─────────────────────────────────────────────────────
export {
  scanCode,
  type SecurityFinding,
  type Severity,
} from "./security/scanner.ts";
