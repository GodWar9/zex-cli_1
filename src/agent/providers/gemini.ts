import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type {
  ConversationMessage,
  LLMProvider,
  ProviderConfig,
  StreamChunk,
} from '../types.ts';
import { availableTools } from '../../tools/index.ts';
import { buildPrunedSystemPrompt } from '../pruner.ts';
import { KeyPool } from '../keyPool.ts';

// Map our JSON schema to Gemini's SchemaType
function mapSchemaType(typeStr: string): SchemaType {
  switch (typeStr) {
    case 'string': return SchemaType.STRING;
    case 'number': return SchemaType.NUMBER;
    case 'integer': return SchemaType.INTEGER;
    case 'boolean': return SchemaType.BOOLEAN;
    case 'array': return SchemaType.ARRAY;
    case 'object': return SchemaType.OBJECT;
    default: return SchemaType.STRING;
  }
}

function convertToolsToGemini() {
  const geminiTools = availableTools.map(tool => {
    const props: Record<string, any> = {};
    if (tool.inputSchema.properties) {
      for (const [key, val] of Object.entries(tool.inputSchema.properties as Record<string, any>)) {
        props[key] = {
          type: mapSchemaType(val.type),
          description: val.description || '',
        };
      }
    }

    return {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: SchemaType.OBJECT,
        properties: props,
        required: tool.inputSchema.required || [],
      }
    };
  });

  return geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : undefined;
}

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_MAX_TOKENS = 8192;

// ─── Per-provider singleton pool ──────────────────────────────────────────────
// One pool per process — keys are shared across turns.
let _keyPool: KeyPool | null = null;

function getKeyPool(config: ProviderConfig): KeyPool {
  if (!_keyPool) {
    // Support apiKeys array from config (set via ~/.zex/config.json)
    const configKeys = (config as any).apiKeys as string[] | undefined;
    if (config.apiKey && !configKeys) {
      // Single key from config: wrap it but still pick up env pool if set
      try {
        _keyPool = KeyPool.fromEnv(undefined);
      } catch {
        _keyPool = new KeyPool([config.apiKey]);
      }
    } else {
      _keyPool = KeyPool.fromEnv(configKeys);
    }
  }
  return _keyPool;
}

export class GeminiProvider implements LLMProvider {
  readonly id = 'gemini' as const;

  async *stream(
    messages: ConversationMessage[],
    config: ProviderConfig,
  ): AsyncGenerator<StreamChunk> {
    const pool = getKeyPool(config);

    const apiKey = pool.getCurrentKey();
    if (!apiKey) {
      const waitMs = pool.msUntilNextAvailable();
      const waitSecs = Math.ceil(waitMs / 1000);
      yield {
        type: 'error',
        message: `All ${pool.totalKeys} Gemini API keys are on cooldown. Next key available in ~${waitSecs}s. (${pool.summaryLine()})`,
        code: 'all_keys_exhausted',
      };
      return;
    }

    const model = config.model || DEFAULT_MODEL;
    yield { type: 'start', model };

    const toolNames = availableTools.map((t) => t.name);
    // Use pruned system prompt — only sends what's needed for this turn type
    const systemPrompt = config.systemPrompt ?? buildPrunedSystemPrompt(messages, toolNames);

    const genAI = new GoogleGenerativeAI(apiKey);

    const geminiModel = genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
      tools: convertToolsToGemini()
    });

    const chatMessages = messages.filter((m) => m.role !== 'system');

    const history = [];
    for (let i = 0; i < chatMessages.length - 1; i++) {
        const m = chatMessages[i];
        if (!m) continue;
        if (m.role === 'user') {
            history.push({ role: 'user', parts: [{ text: m.content }] });
        } else if (m.role === 'assistant') {
            const parts: any[] = [];
            if (m.content) parts.push({ text: m.content });
            if (m.toolCalls) {
                for (const tc of m.toolCalls) {
                    if (tc.originalPart) {
                        parts.push(tc.originalPart);
                    } else {
                        parts.push({ functionCall: { name: tc.name, args: tc.args } });
                    }
                }
            }
            if (parts.length === 0) parts.push({ text: "Acknowledged." });
            history.push({ role: 'model', parts });
        } else if (m.role === 'tool') {
            history.push({
                role: 'function',
                parts: [{
                    functionResponse: {
                        name: m.name || 'unknown_tool',
                        response: { name: m.name || 'unknown_tool', content: m.content }
                    }
                }]
            });
        }
    }

    const lastMessage = chatMessages[chatMessages.length - 1];
    
    let sendParts: any[] = [];
    if (lastMessage && lastMessage.role === 'user') {
        sendParts = [{ text: lastMessage.content }];
    } else if (lastMessage && lastMessage.role === 'tool') {
         sendParts = [{
            functionResponse: {
                name: lastMessage.name || 'unknown_tool',
                response: { name: lastMessage.name || 'unknown_tool', content: lastMessage.content }
            }
        }];
    }

    try {
      const chat = geminiModel.startChat({
        history,
        generationConfig: {
          maxOutputTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
          temperature: config.temperature,
        },
      });

      const result = await chat.sendMessageStream(sendParts);

      let outputTokens = 0;
      let inputTokens = 0;

      for await (const chunk of result.stream) {
        const candidateParts = chunk.candidates?.[0]?.content?.parts || [];
        for (const part of candidateParts) {
            if (part.functionCall) {
               yield {
                 type: 'tool_call',
                 toolCall: { 
                     id: `call_${Math.random().toString(36).substring(7)}`, 
                     name: part.functionCall.name, 
                     args: part.functionCall.args, 
                     originalPart: part 
                 }
               };
            }
        }
        
        const text = chunk.text();
        if (text) {
          yield { type: 'delta', text };
        }
      }

      try {
        const finalResponse = await result.response;
        const usage = finalResponse.usageMetadata;
        if (usage) {
          inputTokens = usage.promptTokenCount ?? 0;
          outputTokens = usage.candidatesTokenCount ?? 0;
        }
        const finishReason = finalResponse.candidates?.[0]?.finishReason;
        yield { type: 'usage', inputTokens, outputTokens };
        yield {
          type: 'done',
          stopReason: finishReason === 'STOP' ? 'end_turn' : (finishReason ?? 'end_turn'),
        };
      } catch {
        yield { type: 'done', stopReason: 'end_turn' };
      }
    } catch (err: any) {
      const error = err as Error & { status?: number };

      // 429 = quota exhausted → rotate key and signal retry
      if (error.status === 429) {
        const maskedKey = KeyPool.maskKey(apiKey);
        const nextKey = pool.markExhausted(apiKey);
        if (nextKey) {
          // Signal the runner to retry this exact turn with the new key
          yield {
            type: 'error',
            message: `Key ${maskedKey} quota reached — switching to next key (${pool.summaryLine()}). Retrying…`,
            code: 'quota_retry',
          };
        } else {
          const waitSecs = Math.ceil(pool.msUntilNextAvailable() / 1000);
          yield {
            type: 'error',
            message: `All ${pool.totalKeys} Gemini keys exhausted. All on 60s cooldown. Retry in ~${waitSecs}s.\n${pool.summaryLine()}`,
            code: 'all_keys_exhausted',
          };
        }
        return;
      }

      const code = error.status === 400 ? 'invalid_request' : error.status === 403 ? 'invalid_api_key' : 'stream_error';
      yield { type: 'error', message: error.message || String(err), code };
    }
  }
}
