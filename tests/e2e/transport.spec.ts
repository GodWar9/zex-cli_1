import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';

const headers = { authorization: 'Bearer playwright-transport-secret-not-for-production' };
test('all operational endpoints require authentication', async ({ request }) => {
  for (const path of ['/v1/health', '/v1/budget', '/v1/keys', '/v1/ws/session']) {
    expect((await request.get(path)).status()).toBe(401);
  }
  expect((await request.post('/v1/chat', { data: { prompt: 'hello' } })).status()).toBe(401);
  expect((await request.get('/v1/health', { headers })).ok()).toBe(true);
  const keys = await request.get('/v1/keys', { headers });
  expect(await keys.text()).not.toContain('playwright-provider-fixture');
});

test('invalid payloads and unsupported providers fail before provider execution', async ({ request }) => {
  for (const data of [{ prompt: '' }, { prompt: 'hello', provider: 'unsupported' }, { prompt: 'hello', priority: 99 }]) {
    expect((await request.post('/v1/chat', { headers, data })).status()).toBe(400);
  }
  expect((await request.post('/v1/chat', { headers: { ...headers, 'content-type': 'application/json' }, data: '{broken' })).status()).toBe(400);
});

test('chat returns a completed task and streams the same response over WebSocket', async ({ request }) => {
  const socket = new WebSocket('ws://127.0.0.1:3151/v1/ws/playwright-session', { headers });
  const messages: Array<{ type: string; text?: string }> = [];
  socket.on('message', data => messages.push(JSON.parse(data.toString())));
  try {
    await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    const response = await request.post('/v1/chat', { headers, data: { prompt: 'Respond to this transport test', provider: 'openai', model: 'gpt-4o-mini', sessionId: 'playwright-session' } });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'completed', response: 'Deterministic test response' });
    await expect.poll(() => messages.filter(message => message.type === 'chunk').map(message => message.text).join('')).toBe('Deterministic test response');
  } finally { socket.close(); }
});

test('WebSocket upgrade rejects missing credentials', async () => {
  const socket = new WebSocket('ws://127.0.0.1:3151/v1/ws/unauthorized');
  socket.on('error', () => {});
  try {
    const status = await new Promise<number | undefined>(resolve => socket.once('unexpected-response', (_request, response) => { response.resume(); resolve(response.statusCode); }));
    expect(status).toBe(401);
  } finally { socket.terminate(); }
});
