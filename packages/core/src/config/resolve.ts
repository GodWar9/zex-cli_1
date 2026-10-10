import type { ProviderId, ProviderConfig } from '../agent/types.ts';
import type { UserConfig, ZexConfig } from './types.ts';
import { DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE, DEFAULT_SYSTEM_PROMPT } from './defaults.ts';

export const providerDefaults: Record<ProviderId, { model: string; keyEnv: string }> = {
  openai: { model: 'gpt-4o', keyEnv: 'OPENAI_API_KEY' },
  anthropic: { model: 'claude-sonnet-4-5', keyEnv: 'ANTHROPIC_API_KEY' },
  gemini: { model: 'gemini-2.5-flash', keyEnv: 'GEMINI_API_KEY' },
  openrouter: { model: 'openrouter/auto', keyEnv: 'OPENROUTER_API_KEY' },
  ollama: { model: 'llama3.2', keyEnv: '' },
};

function text(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) throw new Error(name + ' must be a non-empty string');
  return value.trim();
}

export function resolveConfig(input: unknown = {}, env: NodeJS.ProcessEnv = process.env): ZexConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Zex config must be a JSON object');
  const user = input as UserConfig;
  const detected = env.GEMINI_API_KEY?.trim() || env.GOOGLE_API_KEY?.trim() || env.GEMINI_API_KEYS?.trim() ? 'gemini'
    : env.ANTHROPIC_API_KEY?.trim() ? 'anthropic' : env.OPENAI_API_KEY?.trim() ? 'openai'
    : env.OPENROUTER_API_KEY?.trim() ? 'openrouter' : 'gemini';
  const selected = text(env.ZEX_PROVIDER, 'ZEX_PROVIDER') ?? text(user.provider, 'provider') ?? detected;
  if (!Object.hasOwn(providerDefaults, selected)) throw new Error('Unsupported provider. Use openai, anthropic, gemini, openrouter or ollama; compatible endpoints use openai with baseUrl.');
  const provider = selected as ProviderId;
  if (user.tools !== undefined && typeof user.tools !== 'boolean') throw new Error('tools must be true or false');
  const savedProviderMatches = user.provider === undefined || user.provider === provider;
  const model = text(env.ZEX_MODEL, 'ZEX_MODEL') ?? (savedProviderMatches ? text(user.model, 'model') : undefined) ?? providerDefaults[provider].model;
  const baseUrl = text(env.ZEX_BASE_URL, 'ZEX_BASE_URL') ?? (savedProviderMatches ? text(user.baseUrl, 'baseUrl') : undefined);
  if (baseUrl) {
    if (!['openai', 'openrouter', 'ollama'].includes(provider)) throw new Error('baseUrl is supported only for OpenAI-compatible providers');
    let url: URL;
    try { url = new URL(baseUrl); } catch { throw new Error('baseUrl must be an absolute HTTP(S) URL'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('baseUrl must be HTTP(S), without credentials, query or fragment');
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Remote baseUrl must use HTTPS');
  }
  let apiKeys: string[] | undefined;
  if (savedProviderMatches && user.apiKeys !== undefined) {
    if (!Array.isArray(user.apiKeys) || !user.apiKeys.length) throw new Error('apiKeys must be a non-empty array');
    apiKeys = user.apiKeys.map(key => text(key, 'apiKeys entry')!);
  }
  const explicitKey = text(env.ZEX_API_KEY, 'ZEX_API_KEY') ?? (savedProviderMatches ? text(user.apiKey, 'apiKey') : undefined);
  if (explicitKey) apiKeys = undefined;
  const envKey = env[providerDefaults[provider].keyEnv]?.trim() || (provider === 'gemini' ? env.GOOGLE_API_KEY?.trim() : undefined);
  if (provider === 'gemini' && !explicitKey && !apiKeys) {
    apiKeys = env.GEMINI_API_KEYS?.split(',').map(key => key.trim()).filter(Boolean);
    if (!apiKeys?.length) apiKeys = undefined;
  }
  if (apiKeys && provider !== 'gemini') throw new Error('apiKeys is supported only for Gemini; use apiKey for other providers');
  const apiKey = explicitKey ?? (apiKeys ? undefined : envKey);
  const maxTokens = user.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = user.temperature ?? DEFAULT_TEMPERATURE;
  if (!Number.isInteger(maxTokens) || maxTokens < 1) throw new Error('maxTokens must be a positive integer');
  if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw new Error('temperature must be between 0 and 2');
  const config: ProviderConfig = { provider, model, apiKey, apiKeys, baseUrl, maxTokens, temperature, systemPrompt: text(user.systemPrompt, 'systemPrompt') ?? DEFAULT_SYSTEM_PROMPT };
  config.tools = user.tools ?? true;
  return { provider: config, multiAgent: user.multiAgent === true };
}
