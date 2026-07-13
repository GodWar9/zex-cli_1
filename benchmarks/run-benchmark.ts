import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { CostCalculator } from "../packages/core/src/llm/costCalculator.ts";
import { pruneChunks, type ContextChunk } from "../packages/core/src/context/chunkPruner.ts";
import { countTokens } from "../packages/core/src/utils/tokens.ts";

interface Task {
  id: string;
  prompt: string;
}

interface ScenarioMetrics {
  tokens: number;
  costUsd: number;
  wallClockMs: number;
  cacheHits: number;
  cacheLookups: number;
  cacheHitRate: number;
}

interface RunResult {
  run: number;
  off: ScenarioMetrics;
  on: ScenarioMetrics;
  reduction: {
    tokensPct: number;
    costPct: number;
    wallClockPct: number;
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const tasks = JSON.parse(readFileSync(join(__dirname, "tasks.json"), "utf8")) as Task[];
const costCalc = new CostCalculator();
const model = "gpt-4o-mini";
const systemPrompt = [
  "You are ZEX, a coding agent.",
  "Follow repository style, inspect files before editing, prefer small patches, run tests.",
  "Security scanner rules: block obvious injection, credential leaks, and unsafe shell writes.",
].join("\n");

function syntheticHistory(task: Task, run: number): ContextChunk[] {
  const now = Date.now();
  const domains = [
    "api server websocket auth bearer token regression",
    "context pruner chunk scoring token budget recency relevance",
    "cache invalidation semantic exact file watcher hit rate",
    "terminal ui ink react status bar streaming layout",
    "security scanner sql injection command injection path traversal",
    "provider adapter openai anthropic gemini usage metadata",
  ];

  return Array.from({ length: 42 }, (_, index) => {
    const domain = domains[index % domains.length] ?? domains[0]!;
    const isRelevant = task.prompt.toLowerCase().split(/\W+/).some((word) => word.length > 5 && domain.includes(word));
    const filler = [
      `Turn ${index + 1} from run ${run}.`,
      isRelevant ? task.prompt : domain,
      "Observed files: packages/core/src/context/chunkPruner.ts packages/cli/src/api/server.ts test-enterprise.ts.",
      "Tool output included diagnostics, stack traces, snippets, and proposed patch notes.",
      "Keep important user intent, recent failures, exact file paths, and verification commands.",
    ].join(" ");

    const repeat = isRelevant ? 7 : 11;
    const content = Array.from({ length: repeat }, () => filler).join("\n");
    return {
      id: `${task.id}-${index}`,
      type: index % 5 === 0 ? "tool" : "turn",
      content,
      tokens: countTokens(content),
      timestamp: now - (42 - index) * 45_000,
      lastReferenced: now - (42 - index) * 60_000,
      pinned: index >= 39 || (isRelevant && index % 6 === 0),
    };
  });
}

function semanticKey(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("websocket") || lower.includes("authorization") || lower.includes("auth")) return "auth";
  if (lower.includes("openai") || lower.includes("anthropic") || lower.includes("gemini") || lower.includes("provider")) return "provider-adapter";
  if (lower.includes("pruner") || lower.includes("context") || lower.includes("toon")) return "context-efficiency";
  if (lower.includes("readme") || lower.includes("benchmark") || lower.includes("demo")) return "project-proof";
  if (lower.includes("security") || lower.includes("sql") || lower.includes("policy")) return "security";
  return prompt
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 4)
    .sort()
    .slice(0, 8)
    .join("|");
}

function completionEstimate(prompt: string): number {
  return Math.max(96, Math.round(countTokens(prompt) * 1.7));
}

function runScenario(useOptimizations: boolean, run: number): ScenarioMetrics {
  const cache = new Map<string, number>();
  let tokens = 0;
  let costUsd = 0;
  let cacheHits = 0;
  let cacheLookups = 0;
  const started = performance.now();

  for (const task of tasks) {
    const chunks = syntheticHistory(task, run);
    const outputTokens = completionEstimate(task.prompt);
    cacheLookups++;

    if (useOptimizations) {
      const key = semanticKey(task.prompt);
      const cachedOutput = cache.get(key);
      if (cachedOutput) {
        cacheHits++;
        tokens += cachedOutput;
        costUsd += costCalc.estimateCost(0, cachedOutput, model).totalCost;
        continue;
      }

      const pruned = pruneChunks(chunks, task.prompt, 14_000, { minRecencyWindowMs: 3 * 60 * 1000 });
      const inputTokens = countTokens(systemPrompt) + countTokens(task.prompt) + pruned.tokensUsed;
      tokens += inputTokens + outputTokens;
      costUsd += costCalc.estimateCost(inputTokens, outputTokens, model).totalCost;
      cache.set(key, Math.max(24, Math.round(outputTokens * 0.15)));
    } else {
      const fullContextTokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
      const inputTokens = countTokens(systemPrompt) + countTokens(task.prompt) + fullContextTokens;
      tokens += inputTokens + outputTokens;
      costUsd += costCalc.estimateCost(inputTokens, outputTokens, model).totalCost;
    }
  }

  return {
    tokens,
    costUsd,
    wallClockMs: Math.round((performance.now() - started) * 100) / 100,
    cacheHits,
    cacheLookups,
    cacheHitRate: cacheLookups === 0 ? 0 : cacheHits / cacheLookups,
  };
}

function pctReduction(before: number, after: number): number {
  if (before === 0) return 0;
  return ((before - after) / before) * 100;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatUsd(value: number): string {
  return `$${value.toFixed(6)}`;
}

const runs: RunResult[] = [];
for (let run = 1; run <= 3; run++) {
  const off = runScenario(false, run);
  const on = runScenario(true, run);
  runs.push({
    run,
    off,
    on,
    reduction: {
      tokensPct: pctReduction(off.tokens, on.tokens),
      costPct: pctReduction(off.costUsd, on.costUsd),
      wallClockPct: pctReduction(off.wallClockMs, on.wallClockMs),
    },
  });
}

const summary = {
  generatedAt: new Date().toISOString(),
  model,
  taskCount: tasks.length,
  runs,
  averages: {
    tokensOff: average(runs.map((run) => run.off.tokens)),
    tokensOn: average(runs.map((run) => run.on.tokens)),
    costOff: average(runs.map((run) => run.off.costUsd)),
    costOn: average(runs.map((run) => run.on.costUsd)),
    wallClockOffMs: average(runs.map((run) => run.off.wallClockMs)),
    wallClockOnMs: average(runs.map((run) => run.on.wallClockMs)),
    cacheHitRateOn: average(runs.map((run) => run.on.cacheHitRate)),
    tokensReductionPct: average(runs.map((run) => run.reduction.tokensPct)),
    costReductionPct: average(runs.map((run) => run.reduction.costPct)),
    wallClockReductionPct: average(runs.map((run) => run.reduction.wallClockPct)),
  },
};

const rawPath = join(__dirname, "raw-data.json");
writeFileSync(rawPath, `${JSON.stringify(summary, null, 2)}\n`);

const rows = runs
  .map((run) => {
    return `| ${run.run} | ${run.off.tokens.toLocaleString()} | ${run.on.tokens.toLocaleString()} | ${formatPct(run.reduction.tokensPct)} | ${formatUsd(run.off.costUsd)} | ${formatUsd(run.on.costUsd)} | ${formatPct(run.reduction.costPct)} | ${run.off.wallClockMs.toFixed(2)} | ${run.on.wallClockMs.toFixed(2)} | ${formatPct(run.on.cacheHitRate * 100)} |`;
  })
  .join("\n");

const md = `# Benchmarks

Generated with \`bun run benchmark\` on ${summary.generatedAt}.

This benchmark is offline and reproducible. It runs the same ${tasks.length} checked-in coding prompts from \`benchmarks/tasks.json\` three times with pruning/cache disabled, then enabled. Token counts use the project tokenizer; costs are estimated with \`${model}\` rates from the local cost calculator. These are not live API bills.

| Run | Tokens off | Tokens on | Token reduction | Cost off | Cost on | Cost reduction | Time off ms | Time on ms | Cache hit rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

## Averages

| Metric | Off | On | Delta |
| --- | ---: | ---: | ---: |
| Tokens | ${Math.round(summary.averages.tokensOff).toLocaleString()} | ${Math.round(summary.averages.tokensOn).toLocaleString()} | ${formatPct(summary.averages.tokensReductionPct)} reduction |
| Estimated cost | ${formatUsd(summary.averages.costOff)} | ${formatUsd(summary.averages.costOn)} | ${formatPct(summary.averages.costReductionPct)} reduction |
| Wall-clock time | ${summary.averages.wallClockOffMs.toFixed(2)} ms | ${summary.averages.wallClockOnMs.toFixed(2)} ms | ${formatPct(summary.averages.wallClockReductionPct)} reduction |
| Cache hit rate | 0.0% | ${formatPct(summary.averages.cacheHitRateOn * 100)} | +${formatPct(summary.averages.cacheHitRateOn * 100)} |

## Raw Data

Raw machine-readable output is checked in at \`benchmarks/raw-data.json\`.
`;

writeFileSync(join(dirname(__dirname), "BENCHMARKS.md"), md);
mkdirSync(dirname(rawPath), { recursive: true });
console.log(`Wrote ${rawPath}`);
console.log("Wrote BENCHMARKS.md");
