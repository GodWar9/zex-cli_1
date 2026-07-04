// ─── Stream handler ──────────────────────────────────────────────────────────
// Bridges the provider's raw AsyncGenerator to whatever the caller needs.
//
// It:
//   1. Passes through all StreamChunks as-is (caller can use for-await)
//   2. Accumulates the full response text
//   3. Tracks total token usage across start/usage/delta events
//
// The caller (runner.ts) drives this per-turn and pushes deltas to the TUI.

import type { ConversationMessage, ProviderConfig, StreamChunk } from './types.ts';
import { getProvider } from './providers/index.ts';

export interface StreamResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
  model: string;
  error?: string;
}

/**
 * Streams an LLM response and yields individual StreamChunks.
 * The caller can render each chunk as it arrives.
 *
 * @example
 * for await (const chunk of streamResponse(messages, config)) {
 *   if (chunk.type === 'delta') appendText(chunk.text);
 *   if (chunk.type === 'done')  markComplete();
 * }
 */
export async function* streamResponse(
  messages: ConversationMessage[],
  config: ProviderConfig,
): AsyncGenerator<StreamChunk> {
  const provider = getProvider(config.provider);
  yield* provider.stream(messages, config);
}

/**
 * Runs a full streaming turn and returns the completed result.
 * Use this when you want a simple awaitable, not token-by-token rendering.
 * For streaming TUI updates, use streamResponse() directly.
 */
export async function runStream(
  messages: ConversationMessage[],
  config: ProviderConfig,
  onDelta?: (text: string) => void,
): Promise<StreamResult> {
  let text = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason = 'end_turn';
  let model = config.model;
  let error: string | undefined;

  for await (const chunk of streamResponse(messages, config)) {
    switch (chunk.type) {
      case 'start':
        model = chunk.model;
        break;
      case 'delta':
        text += chunk.text;
        onDelta?.(chunk.text);
        break;
      case 'usage':
        if (chunk.inputTokens > 0) inputTokens = chunk.inputTokens;
        if (chunk.outputTokens > 0) outputTokens = chunk.outputTokens;
        break;
      case 'done':
        stopReason = chunk.stopReason;
        break;
      case 'error':
        error = chunk.message;
        // Don't throw — let caller inspect the error field
        break;
    }
  }

  return { text, inputTokens, outputTokens, stopReason, model, error };
}
