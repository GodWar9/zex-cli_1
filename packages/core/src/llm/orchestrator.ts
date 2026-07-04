import { KeyPool, type ApiKeyMetadata } from "./keyPool.ts";
import { AdvancedTokenizer, type TokenEstimate } from "./tokenizer.ts";
import { CostCalculator } from "./costCalculator.ts";
import { AdvancedScheduler, type ScheduledTask } from "./advancedScheduler.ts";
import { PredictiveScheduler } from "./predictiveScheduler.ts";
import { LLMProviderFactory } from "./providers.ts";

export interface OrchestratorConfig {
  keys: Array<{
    provider: "openai" | "anthropic" | "gemini";
    apiKey: string;
    priority?: number;
    isBackup?: boolean;
  }>;
  dailyBudgetUSD: number;
  maxConcurrentRequests?: number;
  maxQueueSize?: number;
}

export interface TaskWithMetrics extends ScheduledTask {
  onChunk?: (chunk: string) => void;
  response?: string;
  error?: string;
}

export interface BudgetPlan {
  dailyBudgetUSD: number;
  tokensAvailableToday: number;
  tokensUsedToday: number;
  tokensRemainingToday: number;
  costToday: number;
  costRemaining: number;
  breakdown: {
    byModel: Record<string, { tokens: number; cost: number }>;
    byProvider: Record<string, { tokens: number; cost: number }>;
    byTaskType: Record<string, { tokens: number; cost: number }>;
  };
  recommendations: string[];
}

export class TokenBudgetManager {
  private dailyBudgetUSD = 10.0;
  private hourlyBudgetUSD = 10.0 / 24;
  private lastResetDate = new Date();
  private lastResetHour = new Date().getUTCHours();

  private usage = {
    today: { tokens: 0, cost: 0 },
    thisHour: { tokens: 0, cost: 0 },
    thisMonth: { tokens: 0, cost: 0 }
  };

  private breakdown = {
    byModel: {} as Record<string, { tokens: number; cost: number }>,
    byProvider: {} as Record<string, { tokens: number; cost: number }>,
    byTaskType: {} as Record<string, { tokens: number; cost: number }>
  };

  constructor(dailyBudgetUSD?: number) {
    if (dailyBudgetUSD !== undefined) {
      this.dailyBudgetUSD = dailyBudgetUSD;
      this.hourlyBudgetUSD = dailyBudgetUSD / 24;
    }
  }

  canAfford(
    estimatedTokens: number,
    estimatedCost: number
  ): {
    canAfford: boolean;
    reason?: string;
    recommendation?: string;
  } {
    // Check reset
    this.checkReset();

    if (this.usage.today.cost + estimatedCost > this.dailyBudgetUSD) {
      return {
        canAfford: false,
        reason: `Daily budget exceeded: $${estimatedCost.toFixed(4)} > $${(
          this.dailyBudgetUSD - this.usage.today.cost
        ).toFixed(4)}`,
        recommendation: "Queue for tomorrow or upgrade daily budget"
      };
    }

    if (this.usage.thisHour.cost + estimatedCost > this.hourlyBudgetUSD * 1.5) {
      return {
        canAfford: false,
        reason: `Hourly budget exceeded: $${estimatedCost.toFixed(4)} > $${(
          this.hourlyBudgetUSD * 1.5 - this.usage.thisHour.cost
        ).toFixed(4)}`,
        recommendation: "Wait a few minutes before retrying"
      };
    }

    return { canAfford: true };
  }

  recordUsage(
    tokens: number,
    cost: number,
    model: string,
    provider: string,
    taskType: string
  ) {
    this.checkReset();

    this.usage.today.tokens += tokens;
    this.usage.today.cost += cost;
    this.usage.thisHour.tokens += tokens;
    this.usage.thisHour.cost += cost;
    this.usage.thisMonth.tokens += tokens;
    this.usage.thisMonth.cost += cost;

    // Record model breakdown
    if (!this.breakdown.byModel[model]) {
      this.breakdown.byModel[model] = { tokens: 0, cost: 0 };
    }
    this.breakdown.byModel[model].tokens += tokens;
    this.breakdown.byModel[model].cost += cost;

    // Record provider breakdown
    if (!this.breakdown.byProvider[provider]) {
      this.breakdown.byProvider[provider] = { tokens: 0, cost: 0 };
    }
    this.breakdown.byProvider[provider].tokens += tokens;
    this.breakdown.byProvider[provider].cost += cost;

    // Record task breakdown
    if (!this.breakdown.byTaskType[taskType]) {
      this.breakdown.byTaskType[taskType] = { tokens: 0, cost: 0 };
    }
    this.breakdown.byTaskType[taskType].tokens += tokens;
    this.breakdown.byTaskType[taskType].cost += cost;
  }

  allocateBudget(
    remainingBudgetUSD: number,
    pendingTasks: Array<{
      id: string;
      estimatedTokens: number;
      priority: number;
      type: string;
    }>,
    costCalc: CostCalculator
  ): {
    executeNow: string[];
    deferUntilTomorrow: string[];
    useAlternativeModel: Record<string, string>;
  } {
    const executeNow: string[] = [];
    const deferUntilTomorrow: string[] = [];
    const useAlternativeModel: Record<string, string> = {};

    let budgetRemaining = remainingBudgetUSD;

    const sorted = [...pendingTasks].sort((a, b) => b.priority - a.priority);

    for (const task of sorted) {
      const cheapestOption = costCalc.findCheapestModel(
        task.estimatedTokens,
        Math.ceil(task.estimatedTokens * 0.5)
      );

      if (cheapestOption.cost <= budgetRemaining) {
        executeNow.push(task.id);
        budgetRemaining -= cheapestOption.cost;
      } else if (cheapestOption.cost * 0.7 <= budgetRemaining) {
        useAlternativeModel[task.id] = cheapestOption.model;
        executeNow.push(task.id);
        budgetRemaining -= cheapestOption.cost * 0.7;
      } else {
        deferUntilTomorrow.push(task.id);
      }
    }

    return {
      executeNow,
      deferUntilTomorrow,
      useAlternativeModel
    };
  }

  getBudgetReport(): BudgetPlan {
    this.checkReset();

    const tokensPerDollar = 200000;
    const tokensAvailable = this.dailyBudgetUSD * tokensPerDollar;
    const tokensRemaining = Math.max(0, tokensAvailable - this.usage.today.tokens);
    const costRemaining = Math.max(0, this.dailyBudgetUSD - this.usage.today.cost);

    return {
      dailyBudgetUSD: this.dailyBudgetUSD,
      tokensAvailableToday: tokensAvailable,
      tokensUsedToday: this.usage.today.tokens,
      tokensRemainingToday: tokensRemaining,
      costToday: this.usage.today.cost,
      costRemaining,
      breakdown: {
        byModel: { ...this.breakdown.byModel },
        byProvider: { ...this.breakdown.byProvider },
        byTaskType: { ...this.breakdown.byTaskType }
      },
      recommendations: this.generateRecommendations()
    };
  }

  private checkReset() {
    const now = new Date();
    if (now.getUTCDate() !== this.lastResetDate.getUTCDate()) {
      this.usage.today = { tokens: 0, cost: 0 };
      this.breakdown.byModel = {};
      this.breakdown.byProvider = {};
      this.breakdown.byTaskType = {};
      this.lastResetDate = now;
    }
    if (now.getUTCHours() !== this.lastResetHour) {
      this.usage.thisHour = { tokens: 0, cost: 0 };
      this.lastResetHour = now.getUTCHours();
    }
  }

  private generateRecommendations(): string[] {
    const recs: string[] = [];
    const percentUsed = (this.usage.today.cost / this.dailyBudgetUSD) * 100;

    if (percentUsed > 80) {
      recs.push("⚠️ Budget 80%+ used. Consider deferring non-urgent tasks.");
    }
    if (percentUsed > 50) {
      recs.push("💡 Prefer cheaper models (gemini) for remaining tasks.");
    }
    if (percentUsed < 20) {
      recs.push("✅ Plenty of budget remaining. Can afford higher-quality models.");
    }

    return recs;
  }
}

export interface LLMMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    retried: number;
  };
  tokens: {
    total: number;
    input: number;
    output: number;
  };
  cost: {
    total: number;
    byModel: Record<string, number>;
    byProvider: Record<string, number>;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  keyHealth: {
    healthy: number;
    cooldown: number;
    error: number;
  };
  budgetHealth: {
    dailyBudgetUsed: number;
    dailyBudgetRemaining: number;
    projectedDailySpend: number;
  };
}

export class LLMMonitor {
  private metrics: LLMMetrics = {
    requests: { total: 0, successful: 0, failed: 0, retried: 0 },
    tokens: { total: 0, input: 0, output: 0 },
    cost: { total: 0, byModel: {}, byProvider: {} },
    latency: { p50: 0, p95: 0, p99: 0 },
    keyHealth: { healthy: 0, cooldown: 0, error: 0 },
    budgetHealth: { dailyBudgetUsed: 0, dailyBudgetRemaining: 0, projectedDailySpend: 0 }
  };

  private latencies: number[] = [];

  recordRequest(
    result: {
      success: boolean;
      promptTokens: number;
      completionTokens: number;
      cost: number;
      latencyMs: number;
      model: string;
      provider: string;
      retryCount: number;
    }
  ) {
    this.metrics.requests.total++;
    if (result.success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }
    if (result.retryCount > 0) {
      this.metrics.requests.retried++;
    }

    this.metrics.tokens.input += result.promptTokens;
    this.metrics.tokens.output += result.completionTokens;
    this.metrics.tokens.total += result.promptTokens + result.completionTokens;

    this.metrics.cost.total += result.cost;
    this.metrics.cost.byModel[result.model] = (this.metrics.cost.byModel[result.model] || 0) + result.cost;
    this.metrics.cost.byProvider[result.provider] = (this.metrics.cost.byProvider[result.provider] || 0) + result.cost;

    this.latencies.push(result.latencyMs);
    this.updateLatencyPercentiles();
  }

  private updateLatencyPercentiles() {
    if (this.latencies.length === 0) return;

    const sorted = [...this.latencies].sort((a, b) => a - b);
    this.metrics.latency.p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    this.metrics.latency.p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    this.metrics.latency.p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  }

  getMetrics(): LLMMetrics {
    return this.metrics;
  }

  updateHealthAndBudgetMetrics(keyStats: any, budgetReport: any) {
    this.metrics.keyHealth.healthy = keyStats.healthyKeys || 0;
    this.metrics.keyHealth.cooldown = keyStats.byKey?.filter((k: any) => k.status === "cooldown").length || 0;
    this.metrics.keyHealth.error = keyStats.byKey?.filter((k: any) => k.status === "error").length || 0;

    this.metrics.budgetHealth.dailyBudgetUsed = budgetReport.costToday;
    this.metrics.budgetHealth.dailyBudgetRemaining = budgetReport.costRemaining;
    
    const hoursPassed = new Date().getUTCHours() + 1;
    this.metrics.budgetHealth.projectedDailySpend = (budgetReport.costToday / hoursPassed) * 24;
  }

  generateHealthReport(): {
    status: "healthy" | "warning" | "critical";
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: "healthy" | "warning" | "critical" = "healthy";

    if (this.metrics.requests.total > 0) {
      const successRate = this.metrics.requests.successful / this.metrics.requests.total;
      if (successRate < 0.9) {
        status = "critical";
        issues.push(`Low success rate: ${(successRate * 100).toFixed(2)}%`);
        recommendations.push("Review error logs, check API key health");
      } else if (successRate < 0.99) {
        status = "warning";
        issues.push(`Moderate success rate: ${(successRate * 100).toFixed(2)}%`);
        recommendations.push("Review error logs, check API key health");
      }

      const retryRate = this.metrics.requests.retried / this.metrics.requests.total;
      if (retryRate > 0.1) {
        status = "warning";
        issues.push(`High retry rate: ${(retryRate * 100).toFixed(2)}%`);
        recommendations.push("Rate limits may be exceeded, consider adding more API keys");
      }
    }

    if (this.metrics.latency.p95 > 30000) {
      status = "warning";
      issues.push(`High P95 latency: ${this.metrics.latency.p95}ms`);
      recommendations.push("API provider may be slow, consider failover");
    }

    if (issues.length === 0) {
      issues.push("No issues detected");
    }

    return { status, issues, recommendations };
  }
}

export enum FailureType {
  RateLimit = "rate_limit",
  InvalidKey = "invalid_key",
  ServiceDown = "service_down",
  Timeout = "timeout",
  BadRequest = "bad_request",
  Unknown = "unknown"
}

export class FailureHandler {
  classifyError(error: any): {
    type: FailureType;
    recoverable: boolean;
    shouldRetry: boolean;
    backoffMs: number;
  } {
    const message = (error && error.message) || "";
    const status = (error && error.status) || 0;
    const type = (error && error.type) || "";

    if (status === 429 || message.toLowerCase().includes("rate limit") || message.toLowerCase().includes("429") || type === "RATE_LIMIT") {
      return {
        type: FailureType.RateLimit,
        recoverable: true,
        shouldRetry: true,
        backoffMs: error.retryAfter || 60000
      };
    }

    if (status === 401 || message.toLowerCase().includes("invalid key") || message.toLowerCase().includes("unauthorized") || type === "INVALID_KEY") {
      return {
        type: FailureType.InvalidKey,
        recoverable: false,
        shouldRetry: false,
        backoffMs: 0
      };
    }

    if (status >= 500 || message.toLowerCase().includes("service") || type === "SERVICE_DOWN") {
      return {
        type: FailureType.ServiceDown,
        recoverable: true,
        shouldRetry: true,
        backoffMs: error.retryAfter || 300000
      };
    }

    if (error.code === "ETIMEDOUT" || message.toLowerCase().includes("timeout") || message.toLowerCase().includes("time out")) {
      return {
        type: FailureType.Timeout,
        recoverable: true,
        shouldRetry: true,
        backoffMs: 30000
      };
    }

    if (status === 400 || message.toLowerCase().includes("bad request")) {
      return {
        type: FailureType.BadRequest,
        recoverable: false,
        shouldRetry: false,
        backoffMs: 0
      };
    }

    return {
      type: FailureType.Unknown,
      recoverable: true,
      shouldRetry: true,
      backoffMs: 10000
    };
  }

  async executeWithFailover<T>(
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    options?: {
      maxRetries?: number;
      timeout?: number;
    }
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? 3;
    const timeout = options?.timeout ?? 30000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await Promise.race([
          primaryFn(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Timeout")),
              timeout
            )
          )
        ]);
      } catch (error) {
        const failure = this.classifyError(error);

        if (attempt < maxRetries && failure.shouldRetry) {
          await new Promise(resolve =>
            setTimeout(resolve, failure.backoffMs * (attempt + 1))
          );
          continue;
        }

        try {
          return await fallbackFn();
        } catch (fallbackError) {
          throw new Error(
            `Primary and fallback both failed: ${(error as any).message}, ${(fallbackError as any).message}`
          );
        }
      }
    }

    throw new Error("Max retries exceeded");
  }
}

export class ZexLLMOrchestrator {
  public keyPool: KeyPool;
  public tokenizer: AdvancedTokenizer;
  public costCalc: CostCalculator;
  public scheduler: AdvancedScheduler;
  public predictiveScheduler: PredictiveScheduler;
  public budgetManager: TokenBudgetManager;
  public monitor: LLMMonitor;
  public failureHandler: FailureHandler;
  public providerFactory: LLMProviderFactory;

  public taskQueue: Map<string, TaskWithMetrics> = new Map();
  private executingTasks = new Set<string>();
  private schedulerInterval: any = null;

  constructor(private config: OrchestratorConfig) {
    this.keyPool = new KeyPool(config);
    this.tokenizer = new AdvancedTokenizer({});
    this.costCalc = new CostCalculator();
    this.scheduler = new AdvancedScheduler();
    this.predictiveScheduler = new PredictiveScheduler();
    this.budgetManager = new TokenBudgetManager(config.dailyBudgetUSD);
    this.monitor = new LLMMonitor();
    this.failureHandler = new FailureHandler();
    this.providerFactory = new LLMProviderFactory();

    this.startSchedulerLoop();
  }

  async queueTask(
    prompt: string,
    options?: {
      model?: string;
      priority?: number;
      deadline?: number;
      maxRetries?: number;
      onChunk?: (chunk: string) => void;
    }
  ): Promise<string> {
    const model = options?.model || "gpt-4o-mini";
    const estimate = this.tokenizer.estimateTotalTokens(prompt, model);

    const cost = this.costCalc.estimateCost(
      estimate.promptTokens,
      estimate.estimatedCompletionTokens,
      model
    );

    const canAfford = this.budgetManager.canAfford(
      estimate.totalEstimatedTokens,
      cost.totalCost
    );

    if (!canAfford.canAfford) {
      console.warn(`Cannot afford task: ${canAfford.reason}`);
      throw new Error(canAfford.reason);
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const task: TaskWithMetrics = {
      id: taskId,
      prompt,
      model,
      priority: options?.priority ?? 5,
      estimatedTokens: estimate.totalEstimatedTokens,
      deadline: options?.deadline,
      status: "queued",
      retries: 0,
      maxRetries: options?.maxRetries ?? 3,
      queuedAt: Date.now(),
      deadlineUrgency: options?.deadline
        ? Math.max(0, 1 - ((options.deadline - Date.now()) / 3600000))
        : 0,
      costToExecute: cost.totalCost,
      expectedCompletionTime: this.predictiveScheduler.predictCompletionTime(
        model,
        estimate.promptTokens
      ).expectedCompletionTimeMs,
      dynamicPriority: 0,
      onChunk: options?.onChunk
    };

    this.taskQueue.set(taskId, task);

    console.log(
      `[Orchestrator] Task ${taskId} queued: ${estimate.totalEstimatedTokens} tokens, $${cost.totalCost.toFixed(4)}`
    );

    return taskId;
  }

  private startSchedulerLoop() {
    this.schedulerInterval = setInterval(async () => {
      await this.runScheduler();
    }, 1000); // Poll faster than 5 seconds in execution loop for snappier UI/TUI/testing response
  }

  public async runScheduler() {
    if (this.executingTasks.size >= (this.config.maxConcurrentRequests || 5)) {
      return;
    }

    const queuedTasks = Array.from(this.taskQueue.values())
      .filter(t => t.status === "queued");

    if (queuedTasks.length === 0) {
      return;
    }

    const reordered = this.scheduler.reorderQueue(queuedTasks);

    for (const task of reordered) {
      if (this.executingTasks.size >= (this.config.maxConcurrentRequests || 5)) {
        break;
      }

      try {
        const key = this.keyPool.selectBestKey(task.estimatedTokens);

        task.status = "assigned";
        task.assignedKeyId = key.id;

        this.executingTasks.add(task.id);
        this.executeTask(task).finally(() => {
          this.executingTasks.delete(task.id);
        });
      } catch (error) {
        console.warn(`Cannot assign task ${task.id}: ${(error as Error).message}`);
      }
    }
  }

  private async executeTask(task: TaskWithMetrics) {
    const startTime = Date.now();

    try {
      task.status = "executing";

      const keyId = task.assignedKeyId!;
      const keyMeta = this.keyPool.keys.get(keyId);
      if (!keyMeta) {
        throw new Error(`Key metadata not found for key: ${keyId}`);
      }

      const provider = this.providerFactory.getProvider(
        keyMeta.provider,
        keyMeta.apiKey
      );

      const response = await provider.chat(
        [{ role: "user", content: task.prompt }],
        {
          model: task.model,
          temperature: 0.7,
          onChunk: (chunk: string) => {
            if (task.onChunk) {
              task.onChunk(chunk);
            }
          }
        }
      );

      const completionTime = Date.now() - startTime;
      const cost = this.costCalc.estimateCost(
        response.usage.prompt_tokens,
        response.usage.completion_tokens,
        task.model
      ).totalCost;

      this.keyPool.recordUsage(keyId, {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        cost,
        success: true
      });

      this.monitor.recordRequest({
        success: true,
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        cost,
        latencyMs: completionTime,
        model: task.model,
        provider: keyMeta.provider,
        retryCount: task.retries
      });

      this.budgetManager.recordUsage(
        response.usage.prompt_tokens + response.usage.completion_tokens,
        cost,
        task.model,
        keyMeta.provider,
        "analysis"
      );

      this.predictiveScheduler.recordCompletion(
        task.model,
        response.usage.prompt_tokens,
        completionTime
      );

      task.response = response.text;
      task.status = "completed";
      console.log(`[Orchestrator] Task ${task.id} completed in ${completionTime}ms`);
    } catch (error) {
      const completionTime = Date.now() - startTime;
      const classified = this.failureHandler.classifyError(error);

      if (task.assignedKeyId) {
        const keyId = task.assignedKeyId;
        const keyMeta = this.keyPool.keys.get(keyId);
        const providerName = keyMeta ? keyMeta.provider : "unknown";

        this.keyPool.recordUsage(keyId, {
          promptTokens: 0,
          completionTokens: 0,
          cost: 0,
          success: false,
          error: error as Error
        });

        this.monitor.recordRequest({
          success: false,
          promptTokens: 0,
          completionTokens: 0,
          cost: 0,
          latencyMs: completionTime,
          model: task.model,
          provider: providerName,
          retryCount: task.retries
        });
      }

      if (task.retries < task.maxRetries && classified.shouldRetry) {
        task.retries++;
        task.status = "queued";
        task.assignedKeyId = undefined;

        console.warn(
          `[Orchestrator] Task ${task.id} retry ${task.retries}/${task.maxRetries}`
        );

        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, task.retries) * 1000)
        );
      } else {
        task.status = "failed";
        task.error = (error as Error).message || String(error);
        console.error(
          `[Orchestrator] Task ${task.id} failed: ${classified.type}`
        );
      }
    }
  }

  getTaskResult(taskId: string): any {
    const task = this.taskQueue.get(taskId);
    if (!task) return null;
    return {
      status: task.status,
      result: task.status === "completed" ? (task.response || "...") : null,
      error: task.status === "failed" ? (task.error || "Unknown error") : null
    };
  }

  getHealth() {
    const keyStats = this.keyPool.getKeyStats();
    const budgetReport = this.budgetManager.getBudgetReport();
    this.monitor.updateHealthAndBudgetMetrics(keyStats, budgetReport);

    const metrics = this.monitor.getMetrics();

    return {
      status: this.monitor.generateHealthReport().status,
      metrics,
      keys: keyStats,
      budget: budgetReport,
      queue: {
        total: this.taskQueue.size,
        queued: Array.from(this.taskQueue.values()).filter(t => t.status === "queued").length,
        executing: this.executingTasks.size,
        completed: Array.from(this.taskQueue.values()).filter(t => t.status === "completed").length
      }
    };
  }

  destroy() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
  }
}
