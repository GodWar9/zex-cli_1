// ─── Default config values ────────────────────────────────────────────────────
// Priority for provider selection:
//   1. ~/.zex/config.json (user set)
//   2. OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY env vars
//   3. Ollama at localhost (no key needed)

import type { ProviderId } from '../agent/types.ts';

interface ProviderDefault {
  provider: ProviderId;
  model: string;
}

/**
 * Detect which provider to use by checking environment variables.
 * Returns the first provider whose API key is present in the environment.
 * Falls back to ollama (local, no key required).
 */
export function detectProvider(): ProviderDefault {
  // Priority: Gemini first (optimized for zex context/security features)
  if (process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY'] || process.env['GEMINI_API_KEYS']) {
    return { provider: 'gemini', model: 'gemini-2.5-flash' };
  }
  if (process.env['ANTHROPIC_API_KEY']) {
    return { provider: 'anthropic', model: 'claude-3-5-sonnet-latest' };
  }
  if (process.env['OPENAI_API_KEY']) {
    return { provider: 'openai', model: 'gpt-4o' };
  }
  // Fallback to gemini-2.0-flash as the intended standard model
  return { provider: 'gemini', model: 'gemini-2.0-flash' };
}

export const DEFAULT_MAX_TOKENS = 8192;
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_SYSTEM_PROMPT =
  'You are zex, a concise and precise AI coding assistant running in the terminal. ' +
  'Respond in plain text unless the user asks for code — then use markdown code blocks. ' +
  'Be direct. Do not add unnecessary caveats or filler.';

/** Token budget allocation per spec §1.2 */
export const DEFAULT_TOKEN_BUDGET = {
  maxTokens: 128_000,
  reserved: {
    outputBuffer: 8_000,
    toolResults: 16_000,
    safetyMargin: 4_000,
  },
  allocation: {
    history: 30_000,
    crossFile: 20_000,
    memory: 5_000,
    openFiles: 25_000,
    currentTask: 20_000,
  },
  get available(): number {
    const reserved = this.reserved.outputBuffer + this.reserved.toolResults + this.reserved.safetyMargin;
    return this.maxTokens - reserved;
  },
} as const;

export const DEFAULT_MIN_RECENCY_WINDOW_SEC = 600;
