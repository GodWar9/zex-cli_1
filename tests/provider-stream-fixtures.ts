export interface Call { id: string; name: string; json: string }
export function openAIResponse(calls: Call[] = [], options: { finish?: string; incomplete?: boolean; text?: string } = {}) {
  const frames: unknown[] = [];
  if (calls.length) {
    frames.push({ choices: [{ index: 0, delta: { tool_calls: calls.map((call, index) => ({ index, id: call.id, type: 'function', function: { name: call.name, arguments: call.json.slice(0, 4) } })) }, finish_reason: null }] });
    for (let index = calls.length - 1; index >= 0; index--) frames.push({ choices: [{ index: 0, delta: { tool_calls: [{ index, function: { arguments: calls[index]!.json.slice(4) } }] }, finish_reason: null }] });
  } else frames.push({ choices: [{ index: 0, delta: { content: options.text ?? 'Complete' }, finish_reason: null }] });
  if (!options.incomplete) {
    frames.push({ choices: [{ index: 0, delta: {}, finish_reason: options.finish ?? (calls.length ? 'tool_calls' : 'stop') }] });
    frames.push({ choices: [], usage: { prompt_tokens: 11, completion_tokens: 7 } });
  }
  return new Response(frames.map(frame => 'data: ' + JSON.stringify(frame) + '\n\n').join('') + 'data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
}
export function anthropicResponse(calls: Call[] = [], options: { finish?: string; incomplete?: boolean; text?: string } = {}) {
  const events: Record<string, unknown>[] = [{ type: 'message_start', message: { id: 'msg-test', type: 'message', role: 'assistant', model: 'test-model', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 11, output_tokens: 0 } } }];
  if (calls.length) for (const [index, call] of calls.entries()) {
    events.push({ type: 'content_block_start', index, content_block: { type: 'tool_use', id: call.id, name: call.name, input: {} } });
    for (const part of [call.json.slice(0, 4), call.json.slice(4)]) events.push({ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: part } });
    events.push({ type: 'content_block_stop', index });
  } else {
    events.push({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    events.push({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: options.text ?? 'Complete' } });
    events.push({ type: 'content_block_stop', index: 0 });
  }
  if (!options.incomplete) {
    events.push({ type: 'message_delta', delta: { stop_reason: options.finish ?? (calls.length ? 'tool_use' : 'end_turn'), stop_sequence: null }, usage: { output_tokens: 7 } });
    events.push({ type: 'message_stop' });
  }
  return new Response(events.map(event => 'event: ' + event.type + '\ndata: ' + JSON.stringify(event) + '\n\n').join(''), { headers: { 'content-type': 'text/event-stream' } });
}

