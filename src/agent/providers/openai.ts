import OpenAI from 'openai';
import type {
  ConversationMessage,
  LLMProvider,
  ProviderConfig,
  ProviderId,
  StreamChunk,
} from '../types.ts';

// ─── OpenAI-compatible provider ──────────────────────────────────────────────
// Covers three cases with one adapter class:
//
//   1. OpenAI proper       — provider: 'openai',      baseUrl: (default)
//   2. OpenRouter          — provider: 'openrouter',  baseUrl: 'https://openrouter.ai/api/v1'
//   3. Ollama              — provider: 'ollama',       baseUrl: 'http://localhost:11434/v1'
//
// All three expose the same OpenAI-compatible HTTP interface, so one client handles them.

const PROVIDER_DEFAULTS: Record<
  string,
  { baseUrl: string; envVar: string; defaultModel: string }
> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    envVar: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    envVar: 'OPENROUTER_API_KEY',
    defaultModel: 'anthropic/claude-sonnet-4-5',
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    envVar: '', // ollama needs no key — use dummy
    defaultModel: 'llama3.2',
  },
};

const OPENAI_MAX_TOKENS = 4096;

export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: ProviderId;
  private readonly defaults: { baseUrl: string; envVar: string; defaultModel: string };

  constructor(providerId: 'openai' | 'openrouter' | 'ollama') {
    this.id = providerId;
    this.defaults = PROVIDER_DEFAULTS[providerId]!;
  }

  async *stream(
    messages: ConversationMessage[],
    config: ProviderConfig,
  ): AsyncGenerator<StreamChunk> {
    // Resolve API key — config > env > 'ollama' dummy
    let apiKey =
      config.apiKey ??
      (this.defaults.envVar ? process.env[this.defaults.envVar] : undefined);

    if (!apiKey) {
      if (this.id === 'ollama') {
        apiKey = 'ollama'; // ollama doesn't need a real key
      } else {
        yield {
          type: 'error',
          message: `API key not set for ${this.id}. Set ${this.defaults.envVar} or configure it in settings.`,
          code: 'missing_api_key',
        };
        return;
      }
    }

    const baseUrl = config.baseUrl ?? this.defaults.baseUrl;
    const model = config.model || this.defaults.defaultModel;

    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      // OpenRouter requires these headers for rankings/attribution
      defaultHeaders:
        this.id === 'openrouter'
          ? {
              'HTTP-Referer': 'https://github.com/zex-cli/zex',
              'X-Title': 'zex',
            }
          : {},
    });

    yield { type: 'start', model };

    // Build messages array — include system prompt
    const systemPrompt =
      config.systemPrompt ??
      'You are zex, an AI coding assistant. Be concise, precise and helpful.';

    const oaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
    ];

    try {
      const stream = await client.chat.completions.create({
        model,
        messages: oaiMessages,
        stream: true,
        max_tokens: config.maxTokens ?? OPENAI_MAX_TOKENS,
        temperature: config.temperature,
        stream_options: { include_usage: true },
      });

      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { type: 'delta', text: delta };
        }

        // Usage comes in the final chunk when stream_options.include_usage is set
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
        }

        const finishReason = chunk.choices[0]?.finish_reason;
        if (finishReason) {
          yield { type: 'usage', inputTokens, outputTokens };
          yield {
            type: 'done',
            stopReason:
              finishReason === 'stop'
                ? 'end_turn'
                : finishReason === 'length'
                  ? 'max_tokens'
                  : finishReason,
          };
        }
      }
    } catch (err) {
      const error = err as Error & { status?: number; code?: string };
      const code =
        error.status === 401
          ? 'invalid_api_key'
          : error.status === 429
            ? 'rate_limited'
            : error.status === 503
              ? 'unavailable'
              : 'stream_error';
      yield { type: 'error', message: error.message, code };
    }
  }
}
