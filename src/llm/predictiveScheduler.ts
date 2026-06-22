export interface TaskPrediction {
  expectedCompletionTimeMs: number;
  confidence: number;
  factors: {
    modelFactor: number;
    tokenFactor: number;
    loadFactor: number;
    timeOfDayFactor: number;
  };
}

export class PredictiveScheduler {
  private completionHistory: Array<{
    model: string;
    inputTokens: number;
    completionTimeMs: number;
    timestamp: number;
  }> = [];

  predictCompletionTime(
    model: string,
    inputTokens: number,
    now: number = Date.now()
  ): TaskPrediction {
    const similar = this.completionHistory.filter(h =>
      h.model === model && 
      Math.abs(h.inputTokens - inputTokens) < inputTokens * 0.2
    );

    let baseCompletionTime = 5000;

    if (similar.length > 0) {
      const times = similar.map(s => s.completionTimeMs).sort((a, b) => a - b);
      baseCompletionTime = times[Math.floor(times.length / 2)]!;
    } else {
      const modelLatencies: Record<string, number> = {
        "gpt-4o": 8000,
        "gpt-4o-mini": 4000,
        "claude-3-opus": 10000,
        "claude-3-sonnet": 6000,
        "gemini-2.0-flash": 2000
      };
      baseCompletionTime = (modelLatencies[model] || 5000);
    }

    const factors = {
      modelFactor: this.getModelSlowdownFactor(model),
      tokenFactor: 1 + (inputTokens / 5000) * 0.5,
      loadFactor: this.getCurrentLoadFactor(),
      timeOfDayFactor: this.getTimeOfDayFactor(now)
    };

    const predictedTime =
      baseCompletionTime *
      factors.modelFactor *
      factors.tokenFactor *
      factors.loadFactor *
      factors.timeOfDayFactor;

    const confidence = Math.min(0.95, similar.length / 20);

    return {
      expectedCompletionTimeMs: Math.ceil(predictedTime),
      confidence,
      factors
    };
  }

  findOptimalExecutionOrder(
    tasks: Array<{
      id: string;
      model: string;
      inputTokens: number;
      deadline: number;
      priority: number;
    }>,
    maxConcurrent: number,
    now: number = Date.now()
  ): {
    order: string[];
    deadlineSuccessRate: number;
    criticalTasks: string[];
    recommendations: string[];
  } {
    const predictions = tasks.map(task => ({
      ...task,
      prediction: this.predictCompletionTime(task.model, task.inputTokens, now),
      timeRemaining: task.deadline - now
    }));

    const critical = predictions.filter(p =>
      p.prediction.expectedCompletionTimeMs > p.timeRemaining
    );

    const order = predictions
      .sort((a, b) => {
        const aCritical = critical.some(c => c.id === a.id) ? 1 : 0;
        const bCritical = critical.some(c => c.id === b.id) ? 1 : 0;
        if (aCritical !== bCritical) return bCritical - aCritical;
        return a.deadline - b.deadline;
      })
      .map(p => p.id);

    let currentTime = now;
    let successCount = 0;

    for (const taskId of order) {
      const task = predictions.find(p => p.id === taskId)!;
      currentTime += task.prediction.expectedCompletionTimeMs / maxConcurrent;
      if (currentTime <= task.deadline) {
        successCount++;
      }
    }

    const deadlineSuccessRate = tasks.length > 0 ? successCount / tasks.length : 1.0;

    const recommendations: string[] = [];
    if (deadlineSuccessRate < 0.8) {
      recommendations.push("⚠️ Low deadline success rate. Consider adding more API keys.");
    }
    if (critical.length > 0) {
      recommendations.push(`🔴 ${critical.length} tasks have tight deadlines. Prioritize these.`);
    }

    return {
      order,
      deadlineSuccessRate,
      criticalTasks: critical.map(c => c.id),
      recommendations
    };
  }

  recordCompletion(
    model: string,
    inputTokens: number,
    completionTimeMs: number
  ) {
    this.completionHistory.push({
      model,
      inputTokens,
      completionTimeMs,
      timestamp: Date.now()
    });

    if (this.completionHistory.length > 1000) {
      this.completionHistory.shift();
    }
  }

  private getModelSlowdownFactor(model: string): number {
    const factors: Record<string, number> = {
      "gpt-4o": 1.0,
      "gpt-4o-mini": 0.6,
      "claude-3-opus": 1.2,
      "claude-3-sonnet": 0.8,
      "gemini-2.0-flash": 0.4
    };
    return factors[model] || 1.0;
  }

  private getCurrentLoadFactor(): number {
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) return 1.2;
    if (hour >= 20 || hour <= 6) return 0.8;
    return 1.0;
  }

  private getTimeOfDayFactor(timestamp: number): number {
    const hour = new Date(timestamp).getHours();
    if (hour >= 9 && hour <= 17) return 1.2;
    return 0.9;
  }
}
