// ─── Dynamic Prompt Pruner ───────────────────────────────────────────────────
// Classifies the current turn type and returns only the system prompt segments
// that are actually needed. This directly reduces input token usage on every
// tool loop-back turn (the model already has the full instructions from turn 1).
//
// Turn types:
//   'first_user'    — First message in the session. Send everything.
//   'tool_loopback' — Last message was a tool result. Model already has
//                     instructions; send only core identity + env.
//   'continuation'  — Follow-up user message. Send core + tools that are active.

import type { ConversationMessage } from './types.ts';
import { countTokens } from '../utils/tokens.ts';
import {
  CORE_SEGMENT,
  COLLECTOR_SEGMENT,
  SHELL_TOOL_SEGMENT,
  FS_TOOL_SEGMENT,
  PROJECT_STATUS_SEGMENT,
  UNDERSTANDING_SEGMENT,
  envSegment,
  workingMemorySegment,
} from './prompt.ts';

export type TurnType = 'first_user' | 'tool_loopback' | 'continuation';

/**
 * Classify what kind of turn this is based on the message history.
 * The last non-system message determines the type.
 */
export function classifyTurnType(messages: ConversationMessage[]): TurnType {
  // Filter to non-system messages
  const nonSystem = messages.filter((m) => m.role !== 'system');

  if (nonSystem.length === 0) return 'first_user';

  const last = nonSystem[nonSystem.length - 1]!;

  // Tool result being fed back — model already has full instructions
  if (last.role === 'tool') return 'tool_loopback';

  // First ever user message
  const userMessages = nonSystem.filter((m) => m.role === 'user');
  if (userMessages.length <= 1 && last.role === 'user') return 'first_user';

  // Subsequent user message
  return 'continuation';
}

/**
 * Determine which tool segments to include based on which tools are available.
 * Avoids importing the full tool registry — caller passes tool names.
 */
function selectToolSegments(toolNames: string[]): string[] {
  const segments: string[] = [];
  const hasShell = toolNames.some((n) => n === 'run_shell_command');
  const hasFs = toolNames.some((n) => n === 'read_file' || n === 'write_file' || n === 'patch_file');
  const hasProjectStatus = toolNames.some((n) => n === 'update_project_status');

  if (hasShell) segments.push(SHELL_TOOL_SEGMENT);
  if (hasFs) segments.push(FS_TOOL_SEGMENT);
  if (hasProjectStatus) segments.push(PROJECT_STATUS_SEGMENT);

  return segments;
}

/**
 * Build a pruned system prompt based on the current message history.
 *
 * - first_user     → CORE + all tool segments + PROJECT_STATUS + env  (full)
 * - continuation   → CORE + tool segments + env  (no project status repeat)
 * - tool_loopback  → CORE + env only  (~200 tokens instead of ~900)
 *
 * @param messages   Current conversation history (before the new turn is appended)
 * @param toolNames  Names of registered tools (from availableTools)
 */
export function buildPrunedSystemPrompt(
  messages: ConversationMessage[],
  toolNames: string[],
): string {
  const turnType = classifyTurnType(messages);

  let segments: string[] = [];
  const wm = workingMemorySegment();

  switch (turnType) {
    case 'first_user':
      // Full prompt — give the model everything it needs to understand its role
      segments = [CORE_SEGMENT, COLLECTOR_SEGMENT, ...selectToolSegments(toolNames), UNDERSTANDING_SEGMENT, envSegment()];
      if (wm) segments.unshift(wm); // Put working memory at the top!
      break;

    case 'continuation':
      // User asked a follow-up — include collector (they may be asking about a different part
      // of the project) and tools, but skip project_status (already in context from turn 1)
      segments = [CORE_SEGMENT, COLLECTOR_SEGMENT, ...selectToolSegments(toolNames), UNDERSTANDING_SEGMENT, envSegment()];
      if (wm) segments.unshift(wm); // Put working memory at the top!
      break;

    case 'tool_loopback':
      // Model is just reading tool results — it already knows everything.
      // Send only core identity + current env (date/cwd could change).
      segments = [CORE_SEGMENT, envSegment()];
      break;
  }

  return segments.join('\n\n').trim();
}

/** Exact token count via js-tiktoken. */
export function estimateTokens(text: string): number {
  return countTokens(text);
}
