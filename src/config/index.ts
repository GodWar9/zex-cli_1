// ─── Config loader ────────────────────────────────────────────────────────────
// Reads ~/.zex/config.json and merges with env vars + defaults.
//
// Priority (highest → lowest):
//   1. ~/.zex/config.json (explicit user config)
//   2. Environment variables (ANTHROPIC_API_KEY, etc.)
//   3. Compiled defaults (detectProvider + DEFAULT_* constants)
//
// Config is read once and cached for the process lifetime.
// Use reloadConfig() in tests or if config can change at runtime.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  detectProvider,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_SYSTEM_PROMPT,
} from './defaults.ts';
import type { ZexConfig, UserConfig } from './types.ts';
import type { ProviderConfig, ProviderId } from '../agent/types.ts';

// Re-export so callers can import from config/index.ts
export type { ZexConfig, UserConfig };
export type { ProviderId };

const CONFIG_PATH = join(homedir(), '.zex', 'config.json');

let _cachedConfig: ZexConfig | null = null;

function readUserConfig(): UserConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(raw) as UserConfig;
    }
  } catch {
    // Malformed config — ignore and use defaults
  }
  return {};
}

function buildConfig(user: UserConfig): ZexConfig {
  const detected = detectProvider();

  const provider: ProviderId = user.provider ?? detected.provider;
  const model = user.model ?? detected.model;
  const apiKey = user.apiKey; // explicit key wins; env vars are read by providers
  const baseUrl = user.baseUrl;
  const maxTokens = user.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = user.temperature ?? DEFAULT_TEMPERATURE;
  const systemPrompt = user.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

  const providerConfig: ProviderConfig = {
    provider,
    model,
    apiKey,
    baseUrl,
    maxTokens,
    temperature,
    systemPrompt,
  };

  return {
    provider: providerConfig,
    multiAgent: user.multiAgent ?? false,
  };
}

export function loadConfig(): ZexConfig {
  if (_cachedConfig) return _cachedConfig;
  const user = readUserConfig();
  _cachedConfig = buildConfig(user);
  return _cachedConfig;
}

/** Force re-read of config file (useful after user edits ~/.zex/config.json) */
export function reloadConfig(): ZexConfig {
  _cachedConfig = null;
  return loadConfig();
}

/** Get just the active model label for display in StatusBar */
export function getActiveModelLabel(): string {
  const config = loadConfig();
  const { provider, model } = config.provider;
  // e.g. "claude-sonnet-4-5" → "anthropic · claude-sonnet-4-5"
  return `${provider} · ${model}`;
}
