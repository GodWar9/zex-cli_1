import OpenAI from 'openai';
import type { ConversationMessage, LLMProvider, ProviderConfig, ProviderId, StreamChunk } from '../types.ts';
import { availableTools } from '../../tools/index.ts';
import { ToolCallBuffer } from './tool-calls.ts';

const DEFAULTS = {
  openai: { baseUrl: 'https://api.openai.com/v1', envVar: 'OPENAI_API_KEY', model: 'gpt-4o' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', envVar: 'OPENROUTER_API_KEY', model: 'openrouter/auto' },
  ollama: { baseUrl: 'http://localhost:11434/v1', envVar: '', model: 'llama3.2' },
};
export function openAIMessages(messages: ConversationMessage[], config: ProviderConfig): OpenAI.ChatCompletionMessageParam[] {
  const system = [config.systemPrompt, ...messages.filter(m => m.role === 'system').map(m => m.content)].filter(Boolean).join('\n\n');
  return [
    { role: 'system', content: system || 'You are zex, a coding assistant. Use available tools when needed.' },
    ...messages.filter(m => m.role !== 'system').map((m): OpenAI.ChatCompletionMessageParam => {
      if (m.role === 'tool') {
        if (!m.toolCallId) throw new Error('Tool result is missing its call ID');
        return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
      }
      if (m.role === 'assistant') return {
        role: 'assistant', content: m.content || null,
        ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map(tc => ({ id: tc.id, type: 'function' as const, function: { name: tc.name, arguments: JSON.stringify(tc.args) } })) } : {}),
      };
      return { role: 'user', content: m.parts ? m.parts.map(p => p.type === 'text'
        ? { type: 'text' as const, text: p.text }
        : { type: 'image_url' as const, image_url: { url: 'data:' + p.mimeType + ';base64,' + p.data } }) : m.content };
    }),
  ];
}
export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: ProviderId;
  private defaults: typeof DEFAULTS[keyof typeof DEFAULTS];
  constructor(id: keyof typeof DEFAULTS) { this.id = id; this.defaults = DEFAULTS[id]; }
  async *stream(messages: ConversationMessage[], config: ProviderConfig): AsyncGenerator<StreamChunk> {
    const apiKey = config.apiKey ?? process.env[this.defaults.envVar] ?? (this.id === 'ollama' ? 'ollama' : undefined);
    if (!apiKey) { yield { type: 'error', code: 'missing_api_key', message: 'API key not set for ' + this.id }; return; }
    const model = config.model || this.defaults.model;
    const client = new OpenAI({ apiKey, baseURL: config.baseUrl ?? this.defaults.baseUrl,
      defaultHeaders: this.id === 'openrouter' ? { 'HTTP-Referer': 'https://github.com/GodWar9/zex-cli_1', 'X-Title': 'zex' } : {} });
    yield { type: 'start', model };
    try {
      const stream = await client.chat.completions.create({
        model, messages: openAIMessages(messages, config), stream: true,
        max_tokens: config.maxTokens ?? 4096, temperature: config.temperature,
        stream_options: { include_usage: true },
        ...(config.tools === false ? {} : { tools: availableTools.map(tool => ({
          type: 'function' as const, function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
        })) }),
      });
      const calls = new ToolCallBuffer();
      let inputTokens = 0, outputTokens = 0;
      let finish: string | null = null;
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.delta.content) yield { type: 'delta', text: choice.delta.content };
        for (const call of choice?.delta.tool_calls ?? []) {
          if (config.tools === false) throw new Error('Provider requested a tool while tools are disabled');
          calls.append(call.index, call.id, call.function?.name, call.function?.arguments);
        }
        if (chunk.usage) { inputTokens = chunk.usage.prompt_tokens; outputTokens = chunk.usage.completion_tokens; }
        if (choice?.finish_reason) finish = choice.finish_reason;
      }
      if (!finish) throw new Error('Provider stream ended without a completion marker');
      if (calls.size && finish !== 'tool_calls') throw new Error('Tool response was interrupted or truncated');
      if (finish === 'tool_calls' && !calls.size) throw new Error('Provider finished a tool response without calls');
      const complete = calls.finish();
      for (const toolCall of complete) yield { type: 'tool_call', toolCall };
      // Usage can arrive AFTER finish_reason in a final empty-choices chunk.
      yield { type: 'usage', inputTokens, outputTokens };
      yield { type: 'done', stopReason: finish === 'stop' ? 'end_turn' : finish === 'length' ? 'max_tokens' : finish === 'tool_calls' ? 'tool_use' : finish };
    } catch (err) {
      const error = err as Error & { status?: number };
      yield { type: 'error', message: error.message, code: error.status === 401 ? 'invalid_api_key' : error.status === 429 ? 'rate_limited' : 'stream_error' };
    }
  }
}
