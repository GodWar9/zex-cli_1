import Anthropic from '@anthropic-ai/sdk';
import type {
  ConversationMessage,
  LLMProvider,
  ProviderConfig,
  StreamChunk,
} from '../types.ts';

// ─── Anthropic provider ──────────────────────────────────────────────────────
// Uses the official Anthropic SDK with native streaming.
// Supports all claude-* models.
//
// Default model: claude-sonnet-4-5 (fast + smart, great for coding)
// Other options: claude-opus-4-5, claude-haiku-3-5

const DEFAULT_MODEL = 'claude-sonnet-4-5';
const DEFAULT_MAX_TOKENS = 8192;

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const;

  async *stream(
    messages: ConversationMessage[],
    config: ProviderConfig,
  ): AsyncGenerator<StreamChunk> {
    const apiKey = config.apiKey ?? process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      yield {
        type: 'error',
        message: 'ANTHROPIC_API_KEY is not set. Set it in config or environment.',
        code: 'missing_api_key',
      };
      return;
    }

    const client = new Anthropic({ apiKey });

    // Separate system messages from conversation messages
    const systemMsgs = messages.filter((m) => m.role === 'system');
    const chatMsgs = messages.filter((m) => m.role !== 'system');

    const systemPrompt =
      config.systemPrompt ??
      (systemMsgs.length > 0
        ? systemMsgs.map((m) => m.content).join('\n\n')
        : 'You are zex, an AI coding assistant. Be concise, precise and helpful.');

    const model = config.model || DEFAULT_MODEL;

    yield { type: 'start', model };

    try {
      const stream = client.messages.stream({
        model,
        max_tokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: systemPrompt,
        temperature: config.temperature,
        messages: chatMsgs.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield { type: 'delta', text: event.delta.text };
          }
        } else if (event.type === 'message_delta') {
          yield {
            type: 'usage',
            inputTokens: 0, // input tokens come in message_start
            outputTokens: event.usage.output_tokens,
          };
          yield {
            type: 'done',
            stopReason: event.delta.stop_reason ?? 'end_turn',
          };
        } else if (event.type === 'message_start') {
          // Update usage with input tokens
          yield {
            type: 'usage',
            inputTokens: event.message.usage.input_tokens,
            outputTokens: 0,
          };
        }
      }
    } catch (err) {
      const error = err as Error & { status?: number };
      const code =
        error.status === 401
          ? 'invalid_api_key'
          : error.status === 429
            ? 'rate_limited'
            : error.status === 529
              ? 'overloaded'
              : 'stream_error';
      yield { type: 'error', message: error.message, code };
    }
  }
}
