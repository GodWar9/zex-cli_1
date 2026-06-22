export interface ApiKeyMetadata {
  id: string;
  provider: "openai" | "anthropic" | "gemini";
  apiKey: string;
  tokensUsedLifetime: number;
  tokensUsedToday: number;
  costToday: number;
  requestsToday: number;
  quota: {
    dailyLimit: number;
    hourlyLimit: number;
    requestsPerMinute: number;
  };
  status: "healthy" | "cooldown" | "exhausted" | "error";
  lastUsed: number;
  errorCount: number;
  consecutiveErrors: number;
  cooldownUntil?: number;
  priority: number;
  isBackup: boolean;
}

export interface KeyPoolConfig {
  keys: Array<{
    provider: "openai" | "anthropic" | "gemini";
    apiKey: string;
    priority?: number;
    isBackup?: boolean;
  }>;
}

export class KeyPool {
  public keys: Map<string, ApiKeyMetadata> = new Map();
  public stats = {
    totalRequests: 0,
    totalTokens: 0,
    totalCost: 0,
    lastCostCheckDate: new Date()
  };

  constructor(config?: KeyPoolConfig) {
    if (config?.keys) {
      this.loadKeysFromConfig(config.keys);
    }
  }

  loadKeysFromConfig(keysConfig: Array<{
    provider: "openai" | "anthropic" | "gemini";
    apiKey: string;
    priority?: number;
    isBackup?: boolean;
  }>) {
    for (const keyConfig of keysConfig) {
      const id = `${keyConfig.provider}-${Math.random().toString(36).substring(7)}`;
      const key: ApiKeyMetadata = {
        id,
        provider: keyConfig.provider,
        apiKey: keyConfig.apiKey,
        tokensUsedLifetime: 0,
        tokensUsedToday: 0,
        costToday: 0,
        requestsToday: 0,
        quota: this.getDefaultQuota(keyConfig.provider),
        status: "healthy",
        lastUsed: 0,
        errorCount: 0,
        consecutiveErrors: 0,
        priority: keyConfig.priority || 5,
        isBackup: keyConfig.isBackup || false
      };
      this.keys.set(id, key);
    }
  }

  selectBestKey(
    tokensEstimated: number,
    constraints?: {
      provider?: "openai" | "anthropic" | "gemini";
      excludeKeys?: string[];
      preferCheap?: boolean;
    }
  ): ApiKeyMetadata {
    const now = Date.now();
    const candidates = Array.from(this.keys.values())
      .filter(key => {
        if (key.status === "error" || key.status === "exhausted") {
          return false;
        }
        if (constraints?.excludeKeys?.includes(key.id)) {
          return false;
        }
        if (key.tokensUsedToday + tokensEstimated > key.quota.dailyLimit) {
          return false;
        }
        if (key.cooldownUntil && now < key.cooldownUntil) {
          return false;
        }
        if (constraints?.provider && key.provider !== constraints.provider) {
          return false;
        }
        return true;
      });

    if (candidates.length === 0) {
      throw new Error("No available keys with sufficient quota");
    }

    const scoreKey = (key: ApiKeyMetadata): number => {
      let score = 0;
      score += key.priority * 10;
      score += (10 - key.consecutiveErrors) * 5;
      const quotaRemaining = key.quota.dailyLimit - key.tokensUsedToday;
      const quotaRatio = quotaRemaining / key.quota.dailyLimit;
      score += quotaRatio * 30;

      const timeSinceLastUse = (now - key.lastUsed) / 1000;
      score += Math.min(timeSinceLastUse / 100, 20);

      if (quotaRatio < 0.5) {
        score -= (0.5 - quotaRatio) * 100;
      }
      return score;
    };

    const sorted = candidates.sort((a, b) => scoreKey(b) - scoreKey(a));
    return sorted[0]!;
  }

  recordUsage(
    keyId: string,
    usage: {
      promptTokens: number;
      completionTokens: number;
      cost: number;
      success: boolean;
      error?: Error;
    }
  ) {
    const key = this.keys.get(keyId);
    if (!key) throw new Error(`Key not found: ${keyId}`);

    const totalTokens = usage.promptTokens + usage.completionTokens;

    if (usage.success) {
      key.tokensUsedToday += totalTokens;
      key.tokensUsedLifetime += totalTokens;
      key.costToday += usage.cost;
      key.requestsToday++;
      key.lastUsed = Date.now();
      key.consecutiveErrors = 0;
      key.status = "healthy";

      this.stats.totalTokens += totalTokens;
      this.stats.totalCost += usage.cost;
      this.stats.totalRequests++;

      const now = new Date();
      const lastCheck = this.stats.lastCostCheckDate;
      if (now.getUTCDate() !== lastCheck.getUTCDate()) {
        key.tokensUsedToday = 0;
        key.costToday = 0;
        key.requestsToday = 0;
        this.stats.lastCostCheckDate = now;
      }
    } else {
      key.consecutiveErrors++;
      key.errorCount++;
      key.lastUsed = Date.now();

      if (key.consecutiveErrors >= 3) {
        const backoffMs = Math.min(
          Math.pow(5, key.consecutiveErrors - 3) * 60000,
          3600000
        );
        key.cooldownUntil = Date.now() + backoffMs;
        key.status = "cooldown";
      } else {
        key.status = "error";
      }
    }
  }

  getKeyStats(keyId?: string) {
    if (keyId) {
      const key = this.keys.get(keyId);
      if (!key) throw new Error(`Key not found: ${keyId}`);
      return {
        id: key.id,
        provider: key.provider,
        status: key.status,
        tokensUsedToday: key.tokensUsedToday,
        quotaRemaining: key.quota.dailyLimit - key.tokensUsedToday,
        costToday: key.costToday,
        requestsToday: key.requestsToday,
        consecutiveErrors: key.consecutiveErrors,
        cooldownUntil: key.cooldownUntil,
        priority: key.priority
      };
    }

    return {
      totalKeys: this.keys.size,
      healthyKeys: Array.from(this.keys.values()).filter(k => k.status === "healthy").length,
      stats: this.stats,
      byKey: Array.from(this.keys.values()).map(k => ({
        id: k.id,
        provider: k.provider,
        status: k.status,
        quotaRemaining: k.quota.dailyLimit - k.tokensUsedToday
      }))
    };
  }

  private getDefaultQuota(provider: string) {
    const quotas: Record<string, ApiKeyMetadata["quota"]> = {
      "openai": {
        dailyLimit: 1000000,
        hourlyLimit: 100000,
        requestsPerMinute: 100
      },
      "anthropic": {
        dailyLimit: 1000000,
        hourlyLimit: 100000,
        requestsPerMinute: 100
      },
      "gemini": {
        dailyLimit: 2000000,
        hourlyLimit: 200000,
        requestsPerMinute: 100
      }
    };
    return quotas[provider] || quotas["openai"]!;
  }
}
