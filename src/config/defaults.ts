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
  if (process.env['ANTHROPIC_API_KEY']) {
    return { provider: 'anthropic', model: 'claude-sonnet-4-5' };
  }
  if (process.env['OPENAI_API_KEY']) {
    return { provider: 'openai', model: 'gpt-4o' };
  }
  if (process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY']) {
    return { provider: 'gemini', model: 'gemini-2.0-flash' };
  }
  if (process.env['OPENROUTER_API_KEY']) {
    return { provider: 'openrouter', model: 'anthropic/claude-sonnet-4-5' };
  }
  // Default: ollama running locally (no key required)
  return { provider: 'ollama', model: 'llama3.2' };
}

export const DEFAULT_MAX_TOKENS = 8192;
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_SYSTEM_PROMPT =
  'You are zex, a concise and precise AI coding assistant running in the terminal. ' +
  'Respond in plain text unless the user asks for code — then use markdown code blocks. ' +
  'Be direct. Do not add unnecessary caveats or filler.';
