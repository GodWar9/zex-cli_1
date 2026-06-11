// ─── Agent runner ────────────────────────────────────────────────────────────

import { streamResponse } from './stream.ts';
import { loadConfig } from '../config/index.ts';
import type { ConversationMessage, StreamChunk, ToolCallPayload } from './types.ts';
import { getTool } from '../tools/index.ts';

import { compressHistory } from './gc.ts';
import { encodeToolResult } from '../utils/toonEncoder.ts';
import { clarifyIntent } from './clarifier.ts';
import { parseIntent } from './intent.ts';
import { incrementTurn, getCurrentTurn } from '../security/eventLog.ts';
import { dualCache } from '../cache/index.ts';
import { messagesToChunks, pruneChunks, chunksToMessages } from '../context/chunkPruner.ts';
import { formatMemoriesForPrompt } from '../session/memory.ts';
import { metrics } from '../session/metrics.ts';
import { countTokens } from '../utils/tokens.ts';
import { DEFAULT_TOKEN_BUDGET } from '../config/defaults.ts';
import { gc } from './gcState.ts';
import { getCriticalPath } from '../context/depMapper.ts';
import { styleGuidePrompt } from '../context/styleGuide.ts';
import { budgetTracker } from '../session/budget.ts';
import { setAuditTurn, writeAudit } from '../enterprise/auditLog.ts';
import { checkToolPolicy } from '../enterprise/policies.ts';

export type { ConversationMessage };

export interface RunnerCallbacks {
  /** Called for each text token as it arrives — use to update streaming message */
  onDelta: (text: string) => void;
  /** Called once at the end with token usage */
  onUsage: (inputTokens: number, outputTokens: number) => void;
  /** Called if the stream encountered an error */
  onError: (message: string, code?: string) => void;
  /** Called when the stream finishes cleanly */
  onDone: (stopReason: string) => void;
  /** Prompt user for tool approval during a run loop */
  onToolCall: (name: string, args: any) => Promise<boolean>;
  /** Optional: called when a key rotates so UI can display it */
  onKeyRotation?: (message: string) => void;
  /** Optional: called when a security-sensitive intent is detected by the clarifier */
  onSecurityFlag?: (goal: string) => void; // zex: added for intent-clarifier
  /** Optional: called when a tool finishes executing so UI can log it */
  onToolResult?: (name: string, result: string, isError?: boolean) => void;
}

const MAX_QUOTA_RETRIES = 16; // Maximum key rotations before giving up

/**
 * Executes one agent turn: sends the conversation to the configured LLM
 * and drives the stream, validating and executing tools in a loop.
 *
 * Features:
 * - Multi-key rotation: on 'quota_retry' error code, retries the same LLM turn
 *   with the next available Gemini key (up to MAX_QUOTA_RETRIES times).
 * - Checkpoint log: records every successful tool result. If the stream dies
 *   mid-task, the error message lists what was already completed.
 * - Pruned prompts: the Gemini provider automatically sends trimmed system
 *   prompts on tool loop-back turns (handled in pruner.ts + gemini.ts).
 *
 * Returns the final mutated history representing this turn.
 */
export async function runTurn(
  history: ConversationMessage[],
  userMsg: string,
  callbacks: RunnerCallbacks,
): Promise<ConversationMessage[]> {
  incrementTurn();
  setAuditTurn(getCurrentTurn());
  const config = loadConfig();

  // ── Fast intent parser (regex) + LLM clarifier ────────────────────────────
  const parsedIntent = parseIntent(userMsg);
  let effectiveUserMsg = userMsg;

  if (parsedIntent.constraints.forceReview && callbacks.onSecurityFlag) {
    callbacks.onSecurityFlag(`High-risk ${parsedIntent.action}: review required before execution`);
  }

  {
    const cwd = process.cwd();
    const projectContext = `Working dir: ${cwd} | Action: ${parsedIntent.action} | Files: ${parsedIntent.targets.files.join(', ') || 'unknown'}`;
    const intent = await clarifyIntent(userMsg, projectContext);

    if (intent.securitySensitive && callbacks.onSecurityFlag) {
      callbacks.onSecurityFlag(intent.primaryGoal);
    }

    if (!intent.isClear) {
      effectiveUserMsg = `[Intent: ${parsedIntent.action}] ${intent.primaryGoal}\n[Original]: ${userMsg}`;
    } else if (parsedIntent.targets.files.length > 0) {
      effectiveUserMsg = `[Targets: ${parsedIntent.targets.files.join(', ')}]\n${userMsg}`;
    }
  }

  // ── Cache lookup ──────────────────────────────────────────────────────────
  const contextPaths = parsedIntent.targets.files;
  const cacheHit = dualCache.get(userMsg, contextPaths, config.provider.model);
  if (cacheHit) {
    callbacks.onDelta(cacheHit.text);
    callbacks.onUsage(0, countTokens(cacheHit.text));
    callbacks.onDone('cache_hit');
    return [
      ...history,
      { role: 'user', content: userMsg },
      { role: 'assistant', content: cacheHit.text },
    ];
  }

  // ── Context pruning with token budget ─────────────────────────────────────
  const pruneStart = Date.now();
  const compressedHistory = compressHistory(history);

  // Expand target files via dependency graph
  const depFiles = new Set<string>(parsedIntent.targets.files);
  for (const f of parsedIntent.targets.files) {
    for (const dep of getCriticalPath(f, 2)) depFiles.add(dep);
  }

  const chunks = messagesToChunks(compressedHistory, [...depFiles]);
  for (const c of chunks) gc.addRef(c.id, { id: c.id, content: c.content, timestamp: c.timestamp });

  const mustInclude = chunks.filter((c) => c.pinned).map((c) => c.id);
  const pruneResult = pruneChunks(chunks, userMsg, DEFAULT_TOKEN_BUDGET.allocation.history, {
    mustInclude: mustInclude.length ? mustInclude : undefined,
    minRecencyWindowMs: 10 * 60 * 1000,
  });
  const prunedHistory = chunksToMessages(compressedHistory, pruneResult.kept);
  const tokensBefore = chunks.reduce((s, c) => s + c.tokens, 0);
  metrics.recordPrune(tokensBefore, pruneResult.tokensUsed, Date.now() - pruneStart);

  // ── Inject persistent memory ──────────────────────────────────────────────
  const memoryBlock = formatMemoriesForPrompt(userMsg);
  const styleBlock = styleGuidePrompt();
  const systemInjections: ConversationMessage[] = [];
  if (styleBlock) systemInjections.push({ role: 'system', content: styleBlock });
  if (memoryBlock) systemInjections.push({ role: 'system', content: memoryBlock });

  const messages: ConversationMessage[] = [
    ...prunedHistory,
    ...systemInjections,
    { role: 'user', content: effectiveUserMsg },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let isTurnActive = true;

  // Checkpoint log: records successfully completed tool calls this turn.
  // If stream fails mid-task, we surface this so the user knows what was saved.
  const checkpointLog: string[] = [];

  while (isTurnActive) {
    let currentTextResponse = '';
    let toolCallsRequested: ToolCallPayload[] = [];
    isTurnActive = false; // By default, stop unless tool executes

    let quotaRetries = 0;
    let streamDone = false;

    // ── Stream loop with quota-retry ─────────────────────────────────────────
    while (!streamDone) {
      let retryThisTurn = false;

      try {
        for await (const chunk of streamResponse(messages, config.provider)) {
          switch (chunk.type) {
            case 'delta':
              currentTextResponse += chunk.text;
              callbacks.onDelta(chunk.text);
              break;
            case 'tool_call':
              toolCallsRequested.push(chunk.toolCall);
              break;
            case 'usage':
              if (chunk.inputTokens > 0) totalInputTokens += chunk.inputTokens;
              if (chunk.outputTokens > 0) totalOutputTokens += chunk.outputTokens;
              break;
            case 'done':
              streamDone = true;
              break;
            case 'error':
              // ── Quota retry: key rotated, retry the same LLM call ──────────
              if (chunk.code === 'quota_retry' && quotaRetries < MAX_QUOTA_RETRIES) {
                quotaRetries++;
                callbacks.onKeyRotation?.(chunk.message);
                // Reset partial response for this LLM sub-turn
                currentTextResponse = '';
                toolCallsRequested = [];
                retryThisTurn = true;
                break; // Break out of for-await, retry the while(!streamDone) loop
              }
              // ── All keys exhausted or non-retryable error ─────────────────
              const checkpointInfo = checkpointLog.length > 0
                ? `\n\n✓ Work saved before failure:\n${checkpointLog.map((c) => `  ${c}`).join('\n')}`
                : '';
              callbacks.onError(chunk.message + checkpointInfo, chunk.code);
              return messages; // Return partial — surface what we have
          }
        }
        if (!retryThisTurn) streamDone = true;
      } catch (err: any) {
        const checkpointInfo = checkpointLog.length > 0
          ? `\n\n✓ Work saved before failure:\n${checkpointLog.map((c) => `  ${c}`).join('\n')}`
          : '';
        callbacks.onError((err.message ?? 'Unknown error during stream') + checkpointInfo);
        return messages;
      }
    }

    // ── Add what the assistant yielded ──────────────────────────────────────
    if (currentTextResponse || toolCallsRequested.length > 0) {
      messages.push({
        role: 'assistant',
        content: currentTextResponse,
        toolCalls: toolCallsRequested.length > 0 ? toolCallsRequested : undefined
      });
    }

    // ── Run tools requested ─────────────────────────────────────────────────
    if (toolCallsRequested.length > 0) {
      for (const tc of toolCallsRequested) {
        const toolDef = getTool(tc.name);
        let resultText = '';
        
        if (!toolDef) {
          resultText = `Error: Tool '${tc.name}' not found.`;
        } else {
          const policy = checkToolPolicy(tc.name, tc.args);
          if (!policy.allowed) {
            resultText = `Blocked by org policy: ${policy.reason}`;
            if (callbacks.onToolResult) callbacks.onToolResult(tc.name, resultText, true);
            messages.push({ role: 'tool', content: resultText, toolCallId: tc.id, name: tc.name });
            continue;
          }

          const approved = await callbacks.onToolCall(tc.name, tc.args);
          if (approved) {
             const res = await toolDef.execute(tc.args);

             // zex: added for toon-encoding — apply compact encoding only for structured-output tools
             const TOON_TOOLS = new Set(['list_directory', 'search_files']);
             if (TOON_TOOLS.has(tc.name) && !res.isError && res.structuredData) {
               resultText = encodeToolResult(res.structuredData);
             } else {
               resultText = res.content;
             }

             if (callbacks.onToolResult) {
               callbacks.onToolResult(tc.name, resultText, res.isError);
             }

             // ── Checkpoint: record this successful tool result ──────────────
             const argsPreview = JSON.stringify(tc.args).substring(0, 80);
             const status = res.isError ? '✗' : '✓';
             checkpointLog.push(`${status} ${tc.name}(${argsPreview})`);

             writeAudit({
               category: 'tool',
               action: res.isError ? 'error' : 'execute',
               resource: tc.name,
               details: { args: tc.args, isError: res.isError },
             });

             // ── Git Auto-Checkpoint ──────────────────────────────────────────
             if ((tc.name === 'write_file' || tc.name === 'patch_file') && !res.isError) {
               try {
                 const filePath = tc.args.path || 'file';
                 const gitAdd = Bun.spawnSync(['git', 'add', filePath], { cwd: process.cwd() });
                 if (gitAdd.success) {
                   const msg = `zex: ${tc.name} ${filePath}`;
                   Bun.spawnSync(['git', 'commit', '-m', msg], { cwd: process.cwd() });
                 }
               } catch (e) {
                 // fails silently if not a git repo or no git installed
               }
             }
          } else {
             resultText = `User denied the execution of ${tc.name}. Make sure to explain why you needed it and ask for clarification safely.`;
          }
        }

        messages.push({
          role: 'tool',
          content: resultText,
          toolCallId: tc.id,
          name: tc.name
        });
      }
      
      // Loop back to llm so it sees the tool results
      isTurnActive = true;
    }
  }

  metrics.recordTokens(totalInputTokens, totalOutputTokens);
  budgetTracker.trackUsage(totalInputTokens, totalOutputTokens);
  callbacks.onUsage(totalInputTokens, totalOutputTokens);

  // Cache the response for similar future queries
  const finalAssistant = messages.filter((m) => m.role === 'assistant').pop();
  if (finalAssistant?.content) {
    dualCache.set(userMsg, finalAssistant.content, contextPaths, config.provider.model);
  }

  for (const c of chunks) gc.releaseRef(c.id);

  callbacks.onDone('end_turn');
  return messages;
}
