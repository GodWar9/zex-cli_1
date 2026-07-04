// ─── Provider registry ───────────────────────────────────────────────────────
// Single import point for all providers. Supports runtime registration so users
// can add OpenAI-compatible providers via config without code changes.
// Usage:
//   import { getProvider, registerProvider } from './providers/index.ts';
//   const provider = getProvider('anthropic');

import { AnthropicProvider } from './anthropic.ts';
import { OpenAICompatibleProvider } from './openai.ts';
import { GeminiProvider } from './gemini.ts';
import type { LLMProvider, ProviderId } from '../types.ts';

// Lazily instantiate providers so we don't load SDK code unless used
const _cache = new Map<ProviderId, LLMProvider>();

/** Register a custom provider at runtime. Overrides any built-in provider with the same id. */
export function registerProvider(id: ProviderId, provider: LLMProvider): void {
  _cache.set(id, provider);
}

export function getProvider(id: ProviderId): LLMProvider {
  if (_cache.has(id)) return _cache.get(id)!;

  let provider: LLMProvider;

  switch (id) {
    case 'anthropic':
      provider = new AnthropicProvider();
      break;
    case 'openai':
      provider = new OpenAICompatibleProvider('openai');
      break;
    case 'openrouter':
      provider = new OpenAICompatibleProvider('openrouter');
      break;
    case 'ollama':
      provider = new OpenAICompatibleProvider('ollama');
      break;
    case 'gemini':
      provider = new GeminiProvider();
      break;
    default:
      // Check if the id matches an OpenAI-compatible provider config entry
      // (handles custom names like 'groq', 'together', 'lm-studio')
      provider = new OpenAICompatibleProvider(id);
      break;
  }

  _cache.set(id, provider);
  return provider;
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  gemini: 'Gemini',
  ollama: 'Ollama',
};

export { AnthropicProvider, OpenAICompatibleProvider, GeminiProvider };
