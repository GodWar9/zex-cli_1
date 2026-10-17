export interface LocalProvider {
  provider: string;
  model: string;
  baseUrl?: string;
}

/** Explicit, read-only loopback probe. No prompts, tools or credentials are sent. */
export async function checkLocalProvider(config: LocalProvider, timeoutMs = 5000) {
  const result = (status: string, message: string, tested = false) => ({
    status, message, liveConnectionTested: tested, generationTested: false,
  });
  if (config.provider !== 'ollama')
    return result('unsupported', 'Local checks require ZEX_PROVIDER=ollama.');
  let endpoint: URL;
  try { endpoint = new URL(config.baseUrl ?? 'http://localhost:11434/v1'); }
  catch { return result('invalid_endpoint', 'Configure an absolute loopback HTTP(S) endpoint.'); }
  if (!['http:', 'https:'].includes(endpoint.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
    || endpoint.username || endpoint.password || endpoint.search || endpoint.hash)
    return result('invalid_endpoint', 'Local checks only accept loopback URLs without credentials, query or fragment.');
  endpoint.pathname = endpoint.pathname.replace(/\/$/, '') + '/models';
  try {
    const response = await fetch(endpoint, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      await response.body?.cancel();
      return result('http_error', 'Local server rejected its model-list request. Check the configured endpoint.', true);
    }
    const reader = response.body?.getReader();
    if (!reader) return result('invalid_response', 'Local server returned no model list.', true);
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 256 * 1024) {
          await reader.cancel();
          return result('invalid_response', 'Local model list exceeded the diagnostic size limit.', true);
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let payload: unknown;
    try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { return result('invalid_response', 'Local server returned an invalid model list.', true); }
    if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data)
      || !payload.data.every(item => item && typeof item === 'object' && typeof item.id === 'string'))
      return result('invalid_response', 'Local server returned an invalid model list.', true);
    const installed = payload.data.some(item => item.id === config.model
      || (!config.model.includes(':') && item.id === config.model + ':latest'));
    return installed
      ? result('ready', 'Local server is reachable and the selected model is installed.', true)
      : result('model_missing', 'Install the selected model in your local server or set ZEX_MODEL to an installed model.', true);
  } catch {
    return result('unreachable', 'Start the native local model server and check its address. The request failed or timed out.', true);
  }
}
