export interface ModelCost {
  inputTokenCostPer1k: number;
  outputTokenCostPer1k: number;
  model: string;
  provider: string;
}

export class CostCalculator {
  private modelCosts: Map<string, ModelCost> = new Map([
    ["gpt-4o", {
      model: "gpt-4o",
      provider: "openai",
      inputTokenCostPer1k: 0.005,
      outputTokenCostPer1k: 0.015
    }],
    ["gpt-4o-mini", {
      model: "gpt-4o-mini",
      provider: "openai",
      inputTokenCostPer1k: 0.00015,
      outputTokenCostPer1k: 0.0006
    }],
    ["claude-3-opus", {
      model: "claude-3-opus",
      provider: "anthropic",
      inputTokenCostPer1k: 0.015,
      outputTokenCostPer1k: 0.075
    }],
    ["claude-3-sonnet", {
      model: "claude-3-sonnet",
      provider: "anthropic",
      inputTokenCostPer1k: 0.003,
      outputTokenCostPer1k: 0.015
    }],
    ["gemini-2.0-flash", {
      model: "gemini-2.0-flash",
      provider: "google",
      inputTokenCostPer1k: 0.000075,
      outputTokenCostPer1k: 0.0003
    }]
  ]);

  estimateCost(
    promptTokens: number,
    completionTokens: number,
    model: string
  ): {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    costEfficiency: "cheap" | "moderate" | "expensive";
  } {
    const cost = this.modelCosts.get(model) || {
      model,
      provider: "unknown",
      inputTokenCostPer1k: 0.0015,
      outputTokenCostPer1k: 0.005
    };

    const inputCost = (promptTokens / 1000) * cost.inputTokenCostPer1k;
    const outputCost = (completionTokens / 1000) * cost.outputTokenCostPer1k;
    const totalCost = inputCost + outputCost;

    let costEfficiency: "cheap" | "moderate" | "expensive" = "moderate";
    if (totalCost < 0.0005) costEfficiency = "cheap";
    else if (totalCost > 0.01) costEfficiency = "expensive";

    return {
      inputCost,
      outputCost,
      totalCost,
      costEfficiency
    };
  }

  findCheapestModel(
    promptTokens: number,
    completionTokens: number,
    constraints?: {
      providers?: string[];
      excludeModels?: string[];
    }
  ): { model: string; cost: number; savings: number } {
    const candidates = Array.from(this.modelCosts.values())
      .filter(cost => {
        if (constraints?.providers && !constraints.providers.includes(cost.provider)) {
          return false;
        }
        if (constraints?.excludeModels?.includes(cost.model)) {
          return false;
        }
        return true;
      })
      .map(cost => ({
        model: cost.model,
        cost: this.estimateCost(promptTokens, completionTokens, cost.model).totalCost
      }))
      .sort((a, b) => a.cost - b.cost);

    if (candidates.length === 0) {
      throw new Error("No suitable models found");
    }

    const cheapest = candidates[0]!;
    const mostExpensive = candidates[candidates.length - 1]!;
    const savings = mostExpensive.cost - cheapest.cost;

    return {
      model: cheapest.model,
      cost: cheapest.cost,
      savings
    };
  }
}
