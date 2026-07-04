// ─── Message types ──────────────────────────────────────────────────────────

export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolCallPayload {
  id: string;
  name: string;
  args: Record<string, any>;
  originalPart?: any;
}

export interface ConversationMessage {
  role: Role;
  content: string;
  toolCalls?: ToolCallPayload[]; // When role = 'assistant' and requesting a tool
  toolCallId?: string;           // When role = 'tool', correlates to the request
  name?: string;                 // When role = 'tool', name of the tool
}

// ─── Provider IDs ────────────────────────────────────────────────────────────

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'openrouter'
  | 'gemini'
  | 'ollama';

// ─── Provider config ─────────────────────────────────────────────────────────

export interface ProviderConfig {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  /** Base URL override — used for openrouter, ollama, custom OpenAI-compatible endpoints */
  baseUrl?: string;
  /** Max tokens to generate */
  maxTokens?: number;
  /** System prompt override */
  systemPrompt?: string;
  temperature?: number;
}

// ─── Stream chunks ───────────────────────────────────────────────────────────

/** A token delta — the main event type during streaming */
export interface ChunkDelta {
  type: 'delta';
  text: string;
}

/** Stream started — includes model info */
export interface ChunkStart {
  type: 'start';
  model: string;
}

/** Tool call requested by LLM */
export interface ChunkToolCall {
  type: 'tool_call';
  toolCall: ToolCallPayload;
}

/** Usage info — emitted at end of stream */
export interface ChunkUsage {
  type: 'usage';
  inputTokens: number;
  outputTokens: number;
}

/** Stream ended cleanly */
export interface ChunkDone {
  type: 'done';
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | string;
}

/** An error occurred during the stream */
export interface ChunkError {
  type: 'error';
  message: string;
  code?: string;
}

export type StreamChunk =
  | ChunkStart
  | ChunkDelta
  | ChunkToolCall
  | ChunkUsage
  | ChunkDone
  | ChunkError;

// ─── Provider interface ──────────────────────────────────────────────────────

export interface LLMProvider {
  readonly id: ProviderId;
  /** Streams a response given a conversation history.
   *  Yields StreamChunks — caller accumulates deltas for display. */
  stream(
    messages: ConversationMessage[],
    config: ProviderConfig,
  ): AsyncGenerator<StreamChunk>;
}
