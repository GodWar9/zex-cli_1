// ─── LLM Providers (Promise-based API for enterprise orchestrator) ────────────
// NOTE: SDK initialization is duplicated with src/agent/providers/ by design:
// the agent providers use streaming async generators; these use Promise-based
// chat for the orchestrator's task-based execution model.

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type ProviderType = string;

export interface IEnterpriseProvider {
  chat(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options: ProviderChatOptions
  ): Promise<ChatResponse>;
}

export interface ProviderChatOptions {
  model: string;
  maxTokens?: number;
  temperature?: number;
  onChunk?: (chunk: string) => void;
}

export interface ChatResponse {
  text: string;
  usage: { prompt_tokens: number; completion_tokens: number };
  model: string;
}

export class OpenAIProvider implements IEnterpriseProvider {
  private client?: OpenAI;

  constructor(apiKey: string) {
    if (apiKey !== "sk-test") {
      this.client = new OpenAI({ apiKey });
    }
  }

  async chat(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options: ProviderChatOptions
  ): Promise<ChatResponse> {
    if (!this.client) {
      options.onChunk?.("Mock OpenAI response text");
      return {
        text: "Mock OpenAI response text",
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        model: options.model
      };
    }

    try {
      const response = await this.client.chat.completions.create({
        model: options.model,
        messages: messages.map(m => ({ role: m.role as any, content: m.content })),
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7,
        stream: false
      });

      const text = response.choices[0]?.message?.content || "";
      const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0 };

      return {
        text,
        usage: {
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens
        },
        model: options.model
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    const err = error as any;
    if (err.status === 429) {
      const retryAfter = err.response?.headers?.["retry-after"] || "60";
      throw {
        type: "RATE_LIMIT",
        retryAfter: parseInt(retryAfter) * 1000,
        message: err.message
      };
    }
    if (err.status === 401) {
      throw {
        type: "INVALID_KEY",
        message: "Invalid API key"
      };
    }
    if (err.status === 500 || err.status === 503) {
      throw {
        type: "SERVICE_DOWN",
        message: "OpenAI service temporarily unavailable",
        retryAfter: 60000
      };
    }
    throw {
      type: "UNKNOWN",
      message: err.message,
      originalError: err
    };
  }
}

export class AnthropicProvider implements IEnterpriseProvider {
  private client?: Anthropic;

  constructor(apiKey: string) {
    if (apiKey !== "claude-test") {
      this.client = new Anthropic({ apiKey });
    }
  }

  async chat(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options: ProviderChatOptions
  ): Promise<ChatResponse> {
    if (!this.client) {
      options.onChunk?.("Mock Anthropic response text");
      return {
        text: "Mock Anthropic response text",
        usage: { prompt_tokens: 12, completion_tokens: 6 },
        model: options.model
      };
    }

    try {
      const systemMessage = messages.find(m => m.role === "system")?.content || "";
      const userMessages = messages.filter(m => m.role !== "system");

      const response = await this.client.messages.create({
        model: options.model,
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7,
        system: systemMessage || undefined,
        messages: userMessages.map(m => ({ role: m.role as any, content: m.content }))
      });

      let text = "";
      if (response.content && response.content[0]?.type === "text") {
        text = response.content[0].text;
      }
      const usage = response.usage || { input_tokens: 0, output_tokens: 0 };

      return {
        text,
        usage: {
          prompt_tokens: usage.input_tokens,
          completion_tokens: usage.output_tokens
        },
        model: options.model
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    const err = error as any;
    if (err.status === 429) {
      throw {
        type: "RATE_LIMIT",
        retryAfter: 60000,
        message: err.message
      };
    }
    if (err.status === 401) {
      throw {
        type: "INVALID_KEY",
        message: "Invalid API key"
      };
    }
    throw {
      type: "UNKNOWN",
      message: err.message
    };
  }
}

export class GeminiProvider implements IEnterpriseProvider {
  private client?: GoogleGenerativeAI;

  constructor(apiKey: string) {
    if (apiKey !== "gemini-test") {
      this.client = new GoogleGenerativeAI(apiKey);
    }
  }

  async chat(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options: ProviderChatOptions
  ): Promise<ChatResponse> {
    if (!this.client) {
      options.onChunk?.("Mock Gemini response text");
      return {
        text: "Mock Gemini response text",
        usage: { prompt_tokens: 8, completion_tokens: 4 },
        model: options.model
      };
    }

    try {
      const model = this.client.getGenerativeModel({ model: options.model });

      const contents = messages
        .filter(m => m.role !== "system")
        .map(m => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }]
        }));

      const systemInstruction = messages.find(m => m.role === "system")?.content;

      const result = await model.generateContent({
        contents,
        systemInstruction,
        generationConfig: {
          maxOutputTokens: options.maxTokens || 2000,
          temperature: options.temperature || 0.7
        }
      });

      const text = result.response.text();
      const usageMetadata = result.response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 };

      return {
        text,
        usage: {
          prompt_tokens: usageMetadata.promptTokenCount,
          completion_tokens: usageMetadata.candidatesTokenCount
        },
        model: options.model
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    const err = error as any;
    const msg = err.message || "";
    if (msg.includes("429") || msg.includes("quota") || msg.includes("Quota")) {
      throw {
        type: "RATE_LIMIT",
        retryAfter: 60000,
        message: msg
      };
    }
    if (msg.includes("API key") || msg.includes("401") || msg.includes("unauthorized") || msg.includes("Unauthorized")) {
      throw {
        type: "INVALID_KEY",
        message: "Invalid API key"
      };
    }
    throw {
      type: "UNKNOWN",
      message: msg
    };
  }
}

/** Runtime registry for custom enterprise providers. */
const _customProviders = new Map<string, new (apiKey: string) => IEnterpriseProvider>();

export function registerEnterpriseProvider(name: string, ctor: new (apiKey: string) => IEnterpriseProvider): void {
  _customProviders.set(name, ctor);
}

export class LLMProviderFactory {
  private providers = new Map<string, IEnterpriseProvider>();

  getProvider(providerType: ProviderType, apiKey: string): IEnterpriseProvider {
    const key = `${providerType}:${apiKey}`;
    let provider = this.providers.get(key);
    if (!provider) {
      if (_customProviders.has(providerType)) {
        const Ctor = _customProviders.get(providerType)!;
        provider = new Ctor(apiKey);
      } else {
        switch (providerType) {
          case "openai":
            provider = new OpenAIProvider(apiKey);
            break;
          case "anthropic":
            provider = new AnthropicProvider(apiKey);
            break;
          case "gemini":
            provider = new GeminiProvider(apiKey);
            break;
          default:
            throw new Error(`Unknown provider: ${providerType}. Register custom providers via registerEnterpriseProvider().`);
        }
      }
      this.providers.set(key, provider);
    }
    return provider;
  }

  clearCache() {
    this.providers.clear();
  }
}
