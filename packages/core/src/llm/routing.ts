export class ProviderConfigurationError extends Error {}
const defaults: Record<string, string> = {
  openai: 'gpt-4o-mini', anthropic: 'claude-sonnet-4-5', gemini: 'gemini-2.5-flash',
};
export function routeModel(keys: Array<{ provider: string }>, model?: string, requestedProvider?: string) {
  const inferred = model?.startsWith('claude-') ? 'anthropic'
    : model?.startsWith('gemini-') ? 'gemini'
    : model && /^(gpt-|chatgpt-|o[134](?:-|$))/.test(model) ? 'openai' : undefined;
  const configured = [...new Set(keys.map(key => key.provider))];
  if (requestedProvider && inferred && requestedProvider !== inferred) {
    throw new ProviderConfigurationError('Model and provider do not match');
  }
  const provider = requestedProvider ?? inferred ?? (configured.length === 1 || !model ? configured[0] : undefined);
  if (!provider) throw new ProviderConfigurationError('Specify a provider for this model and configure its API key');
  if (!configured.includes(provider)) throw new ProviderConfigurationError('No API key configured for the requested provider');
  const selectedModel = model ?? defaults[provider];
  if (!selectedModel) throw new ProviderConfigurationError('Specify a model for this provider');
  return { provider, model: selectedModel };
}
