// ─── Config types ─────────────────────────────────────────────────────────────

import type { ProviderId, ProviderConfig } from '../agent/types.ts';

export type { ProviderId };

export interface ZexConfig {
  provider: ProviderConfig;
  multiAgent?: boolean;
}

export interface ContextConfig {
  maxTokens?: number;
  minRecencyWindow?: number;
}

export interface CacheConfig {
  semanticThreshold?: number;
  ttlExactCache?: number;
  ttlToolResults?: number;
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
  context?: ContextConfig;
  cache?: CacheConfig;
  /** Enable multi-agent DAG orchestration */
  multiAgent?: boolean;
}
