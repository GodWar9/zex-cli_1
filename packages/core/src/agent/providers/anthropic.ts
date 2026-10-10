import Anthropic from '@anthropic-ai/sdk';
import type { ConversationMessage, LLMProvider, ProviderConfig, StreamChunk } from '../types.ts';
import { availableTools } from '../../tools/index.ts';
import { ToolCallBuffer } from './tool-calls.ts';

export function anthropicMessages(messages: ConversationMessage[]): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const content: Anthropic.ContentBlockParam[] = [];
    if (m.role === 'tool') {
      if (!m.toolCallId) throw new Error('Tool result is missing its call ID');
      content.push({ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content });
    } else {
      if (m.parts && role === 'user') {
        for (const part of m.parts) content.push(part.type === 'text' ? { type: 'text', text: part.text }
          : { type: 'image', source: { type: 'base64', media_type: part.mimeType as 'image/png', data: part.data } });
      } else if (m.content) content.push({ type: 'text', text: m.content });
      for (const call of m.toolCalls ?? []) content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.args });
    }
    if (!content.length) content.push({ type: 'text', text: ' ' });
    const previous = result.at(-1);
    // All results for a parallel tool batch must share the next user message.
    if (previous?.role === role && Array.isArray(previous.content)) previous.content.push(...content);
    else result.push({ role, content });
  }
  return result;
}
export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const;
  async *stream(messages: ConversationMessage[], config: ProviderConfig): AsyncGenerator<StreamChunk> {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { yield { type: 'error', code: 'missing_api_key', message: 'ANTHROPIC_API_KEY is not set' }; return; }
    const client = new Anthropic({ apiKey, baseURL: 'https://api.anthropic.com' });
    const model = config.model || 'claude-sonnet-4-5';
    yield { type: 'start', model };
    try {
      const system = [config.systemPrompt, ...messages.filter(m => m.role === 'system').map(m => m.content)].filter(Boolean).join('\n\n');
      const stream = await client.messages.create({
        model, max_tokens: config.maxTokens ?? 8192, temperature: config.temperature, stream: true,
        system: system || 'You are zex, a coding assistant. Use available tools when needed.',
        messages: anthropicMessages(messages),
        ...(config.tools === false ? {} : { tools: availableTools.map(tool => ({
          name: tool.name, description: tool.description, input_schema: { ...tool.inputSchema, type: 'object' as const },
        })) }),
      });
      const calls = new ToolCallBuffer();
      const open = new Set<number>();
      const initialInputs = new Map<number, string>();
      const receivedJSON = new Set<number>();
      let inputTokens = 0, outputTokens = 0, stopped = false;
      let reason: string | null = null;
      for await (const event of stream) {
        if (event.type === 'message_start') {
          inputTokens = event.message.usage.input_tokens;
          outputTokens = event.message.usage.output_tokens;
        } else if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
          if (config.tools === false) throw new Error('Provider requested a tool while tools are disabled');
          const block = event.content_block;
          calls.append(event.index, block.id, block.name);
          initialInputs.set(event.index, JSON.stringify(block.input));
          open.add(event.index);
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') yield { type: 'delta', text: event.delta.text };
          if (event.delta.type === 'input_json_delta') {
            if (!open.has(event.index)) throw new Error('Unexpected tool argument fragment');
            receivedJSON.add(event.index);
            calls.append(event.index, '', '', event.delta.partial_json);
          }
        } else if (event.type === 'content_block_stop' && open.has(event.index)) {
          if (!receivedJSON.has(event.index)) calls.append(event.index, '', '', initialInputs.get(event.index) ?? '{}');
          open.delete(event.index);
        } else if (event.type === 'message_delta') {
          outputTokens = event.usage.output_tokens;
          reason = event.delta.stop_reason;
        } else if (event.type === 'message_stop') stopped = true;
      }
      if (!stopped || !reason || open.size) throw new Error('Provider stream ended before the response was complete');
      if (calls.size && reason !== 'tool_use') throw new Error('Tool response was interrupted or truncated');
      if (reason === 'tool_use' && !calls.size) throw new Error('Provider finished a tool response without calls');
      const complete = calls.finish();
      for (const toolCall of complete) yield { type: 'tool_call', toolCall };
      yield { type: 'usage', inputTokens, outputTokens };
      yield { type: 'done', stopReason: reason };
    } catch (err) {
      const error = err as Error & { status?: number };
      yield { type: 'error', message: error.message, code: error.status === 401 ? 'invalid_api_key' : error.status === 429 ? 'rate_limited' : 'stream_error' };
    }
  }
}
