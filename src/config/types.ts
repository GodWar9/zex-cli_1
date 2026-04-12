// ─── Config types ─────────────────────────────────────────────────────────────

import type { ProviderId, ProviderConfig } from '../agent/types.ts';

export type { ProviderId };

export interface ZexConfig {
  /** The active LLM provider settings */
  provider: ProviderConfig;
}

export interface UserConfig {
  /** Which provider + model to use */
  provider?: ProviderId;
  model?: string;
  /** Single API key (backward compat) */
  apiKey?: string;
  /** Multiple API keys for failover rotation (Gemini free tier support).
   *  If set, takes priority over apiKey. Also reads from GEMINI_API_KEYS env var. */
  apiKeys?: string[];
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}
