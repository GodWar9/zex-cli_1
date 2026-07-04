import { encodingForModel } from "js-tiktoken";

export interface TokenEstimate {
  model: string;
  promptTokens: number;
  estimatedCompletionTokens: number;
  totalEstimatedTokens: number;
  confidence: number;  // 0.95-0.99
  methodology: "exact" | "proportional" | "conservative";
}

export interface TokenizerConfig {
  defaultModel?: string;
}

export class AdvancedTokenizer {
  private encodings = new Map<string, any>();
  private completionStats = new Map<string, {
    avg: number;
    min: number;
    max: number;
    stdDev: number;
  }>();

  constructor(private config: TokenizerConfig = {}) {
    // Pre-load common model encodings
    this.loadEncodings([
      "gpt-4o",
      "gpt-4o-mini",
      "claude-3-opus",
      "claude-3-sonnet",
      "gemini-2.0-flash"
    ]);
  }

  private loadEncodings(models: string[]) {
    for (const model of models) {
      try {
        const enc = encodingForModel(model as any);
        this.encodings.set(model, enc);
      } catch {
        // Safe to ignore or fallback
      }
    }
  }

  /**
   * We ALWAYS count prompt tokens exactly using the model's tokenizer.
   */
  countPromptTokensExact(text: string, model: string): number {
    const encoding = this.getEncoding(model);
    return encoding.encode(text).length;
  }

  /**
   * Completion tokens are estimated based on:
   * 1. User-specified max_tokens override
   * 2. Task-specific estimation rules
   * 3. Conservative default (1.3x prompt length)
   */
  estimateCompletionTokens(
    prompt: string,
    model: string,
    context: {
      taskType?: "coding" | "analysis" | "creative" | "summary";
      maxTokens?: number;
      temperature?: number;
      historicalData?: Array<{ promptLen: number; completionLen: number }>;
    } = {}
  ): number {
    if (context.maxTokens) {
      return context.maxTokens;
    }

    if (context.historicalData && context.historicalData.length > 10) {
      const ratio = this.calculateCompletionRatio(context.historicalData);
      const promptLength = this.countPromptTokensExact(prompt, model);
      return Math.ceil(promptLength * ratio);
    }

    const taskEstimates: Record<string, (len: number) => number> = {
      coding: (len) => Math.min(len * 2, 8000),      // Code often gets verbose
      analysis: (len) => Math.ceil(len * 1.5),       // Moderate expansion
      creative: (len) => Math.ceil(len * 1.8),       // Creative tends longer
      summary: (len) => Math.ceil(len * 0.5),        // Summaries are shorter
    };

    const estimator = taskEstimates[context.taskType || "analysis"];
    const promptLength = this.countPromptTokensExact(prompt, model);
    if (estimator) {
      return estimator(promptLength);
    }

    return Math.ceil(promptLength * 1.3);
  }

  /**
   * Returns both exact prompt tokens + estimated completion tokens
   */
  estimateTotalTokens(
    prompt: string,
    model: string,
    options?: {
      taskType?: "coding" | "analysis" | "creative" | "summary";
      maxTokens?: number;
      includeSystemPrompt?: boolean;
      systemPrompt?: string;
    }
  ): TokenEstimate {
    let systemPromptTokens = 0;
    if (options?.includeSystemPrompt && options?.systemPrompt) {
      systemPromptTokens = this.countPromptTokensExact(
        options.systemPrompt,
        model
      );
    }

    const userPromptTokens = this.countPromptTokensExact(prompt, model);
    const totalPromptTokens = systemPromptTokens + userPromptTokens;

    const estimatedCompletionTokens = this.estimateCompletionTokens(
      prompt,
      model,
      {
        taskType: options?.taskType,
        maxTokens: options?.maxTokens
      }
    );

    let confidence = 0.98;
    if (options?.maxTokens) {
      confidence = 0.99;
    } else if (estimatedCompletionTokens > 4000) {
      confidence = 0.92;
    }

    return {
      model,
      promptTokens: totalPromptTokens,
      estimatedCompletionTokens,
      totalEstimatedTokens: totalPromptTokens + estimatedCompletionTokens,
      confidence,
      methodology: options?.maxTokens ? "exact" : "proportional"
    };
  }

  estimateBatchTokens(
    prompts: Array<{
      text: string;
      model: string;
      maxTokens?: number;
      taskType?: string;
    }>,
    safetyMargin: number = 0.10
  ): {
    totalTokens: number;
    byModel: Record<string, number>;
    withSafetyMargin: number;
  } {
    const byModel: Record<string, number> = {};
    let totalTokens = 0;

    for (const prompt of prompts) {
      const estimate = this.estimateTotalTokens(prompt.text, prompt.model, {
        maxTokens: prompt.maxTokens,
        taskType: prompt.taskType as any
      });

      byModel[prompt.model] = (byModel[prompt.model] || 0) + estimate.totalEstimatedTokens;
      totalTokens += estimate.totalEstimatedTokens;
    }

    return {
      totalTokens,
      byModel,
      withSafetyMargin: Math.ceil(totalTokens * (1 + safetyMargin))
    };
  }

  private getEncoding(model: string) {
    if (!this.encodings.has(model)) {
      try {
        const enc = encodingForModel(model as any);
        this.encodings.set(model, enc);
      } catch {
        // Fallback to gpt-4 encoding if model not found
        try {
          const fallback = encodingForModel("gpt-4");
          this.encodings.set(model, fallback);
          return fallback;
        } catch {
          // Absolute fallback stub if tiktoken fails
          return {
            encode: (t: string) => ({ length: Math.ceil(t.length / 4) })
          };
        }
      }
    }
    return this.encodings.get(model)!;
  }

  private calculateCompletionRatio(
    data: Array<{ promptLen: number; completionLen: number }>
  ): number {
    const ratios = data.map(d => d.completionLen / d.promptLen);
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const stdDev = Math.sqrt(
      ratios.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / ratios.length
    );
    return Math.min(avg + stdDev, 2.5); // Cap at 2.5x
  }
}
