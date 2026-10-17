import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { checkLocalProvider } from './packages/cli/src/local-doctor.ts';

test('local diagnostics never probe unsupported providers or remote endpoints', async () => {
  assert.equal((await checkLocalProvider({provider:'openai',model:'test'})).liveConnectionTested, false);
  for (const baseUrl of ['https://example.com/v1', 'http://user:secret@localhost/v1', 'http://localhost/v1?secret=yes', 'invalid']) {
    const result = await checkLocalProvider({provider:'ollama',model:'test',baseUrl});
    assert.equal(result.status, 'invalid_endpoint');
    assert.equal(result.liveConnectionTested, false);
  }
});

test('real local HTTP diagnostic distinguishes installed, missing, malformed, HTTP and timeout failures', async () => {
  let mode = 'ready';
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    assert.equal(req.method, 'GET');
    assert.equal(req.url, '/v1/models');
    assert.equal(req.headers.authorization, undefined);
    if (mode === 'timeout') return;
    if (mode === 'redirect') { res.writeHead(302, {location:'https://example.com'}); res.end(); return; }
    if (mode === 'http') { res.writeHead(500); res.end('private-server-secret'); return; }
    res.setHeader('content-type', 'application/json');
    res.end(mode === 'malformed' ? 'private-server-secret' : mode === 'large' ? 'x'.repeat(300 * 1024)
      : JSON.stringify(mode === 'schema' ? {data:[null]} : {data:[{id:mode === 'missing' ? 'other:latest' : 'test:latest'}]}));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const config = {provider:'ollama',model:'test',baseUrl:'http://127.0.0.1:' + address.port + '/v1/'};
  try {
    for (const [scenario, status] of [['ready','ready'], ['missing','model_missing'], ['malformed','invalid_response'],
      ['schema','invalid_response'], ['large','invalid_response'], ['http','http_error'], ['redirect','unreachable'], ['timeout','unreachable']]) {
      mode = scenario;
      const result = await checkLocalProvider(config, scenario === 'timeout' ? 50 : 5000);
      assert.equal(result.status, status, scenario);
      assert.equal(result.liveConnectionTested, true);
      assert.equal(result.generationTested, false);
      assert.ok(!JSON.stringify(result).includes('private-server-secret'));
    }
    assert.equal(requests, 8, 'No redirect or inference requests were followed');
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  assert.equal((await checkLocalProvider(config)).status, 'unreachable');
});
