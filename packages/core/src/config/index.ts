// ─── Config loader ────────────────────────────────────────────────────────────
// Reads ~/.zex/config.json and merges with env vars + defaults.
//
// Priority (highest → lowest):
//   1. ZEX_* environment overrides; then ~/.zex/config.json (or ZEX_CONFIG_FILE)
//   2. Environment variables (ANTHROPIC_API_KEY, etc.)
//   3. Compiled defaults (detectProvider + DEFAULT_* constants)
//
// Config is read once and cached for the process lifetime.
// Use reloadConfig() in tests or if config can change at runtime.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolveConfig } from './resolve.ts';
import type { ZexConfig, UserConfig } from './types.ts';
import type { ProviderId } from '../agent/types.ts';

// Re-export so callers can import from config/index.ts
export type { ZexConfig, UserConfig };
export type { ProviderId };



let _cachedConfig: ZexConfig | null = null;

function readUserConfig(): unknown {
  const path = process.env.ZEX_CONFIG_FILE || join(homedir(), '.zex', 'config.json');
  if (!existsSync(path)) {
    if (process.env.ZEX_CONFIG_FILE) throw new Error('ZEX_CONFIG_FILE does not exist');
    return {};
  }
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { throw new Error('Cannot read Zex config: check file permissions and JSON syntax'); }
}

export function loadConfig(): ZexConfig {
  if (_cachedConfig) return _cachedConfig;
  const user = readUserConfig();
  _cachedConfig = resolveConfig(user);
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
