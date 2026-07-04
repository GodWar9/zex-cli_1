import type { ConversationMessage } from './types.ts';
import { metrics } from '../session/metrics.ts';

/**
 * Returns a new array with old, massive tool payloads compressed to save tokens.
 * This prevents the context window from filling up with 100kb of terminal outputs.
 *
 * Compression is relevance-aware: entries are only compressed if they are:
 *   1. Old (more than 3 user turns ago)
 *   2. Large (> 600 chars)
 *   3. NOT referenced in any of the last 3 messages (by filename, tool name, or keyword)
 */
export function compressHistory(messages: ConversationMessage[], maxTokens?: number): ConversationMessage[] {
  // ── Count total user turns so we can compute turn age ────────────────────
  let totalUserTurns = 0;
  for (const msg of messages) {
    if (msg.role === 'user') totalUserTurns++;
  }

  // ── Build a set of "recent mentions" from the last 3 messages ───────────
  // We extract: words, file-like tokens (contain . or /), and tool call IDs
  const recentMentions = buildRecentMentions(messages, 3);

  let userTurnsSeen = 0;

  return messages.map((msg) => {
    if (msg.role === 'user') userTurnsSeen++;

    const userTurnsAgo = totalUserTurns - userTurnsSeen;
    const isCandidateAge = userTurnsAgo > 3;
    const isCandidateSize = msg.content?.length > 600;

    if (msg.role === 'tool' && isCandidateAge && isCandidateSize) {
      // Check if this tool result is referenced in recent messages
      const isReferenced = isContentReferenced(msg, recentMentions);
      if (!isReferenced) {
        // Build a richer summary stub with metadata to preserve agent memory
        const toolName = msg.name ?? 'tool';
        const lineCount = msg.content.split('\n').length;
        const argsHint = extractArgsHint(msg);
        const bytesSaved = msg.content.length;

        metrics.recordCompaction(bytesSaved);

        return {
          ...msg,
          content: `[Compressed: ${toolName}(${argsHint}) — ~${lineCount} lines, captured at turn ${userTurnsSeen}. Re-read if needed.]`,
        };
      }
    }

    return msg;
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a set of tokens from the last N messages.
 * Extracts: words, file paths / filenames, tool call IDs.
 */
function buildRecentMentions(messages: ConversationMessage[], lookback: number): Set<string> {
  const mentions = new Set<string>();
  const recent = messages.slice(-lookback);

  for (const msg of recent) {
    if (!msg.content) continue;

    // Extract all words and file-like tokens (contain . or /)
    const tokens = msg.content
      .split(/\s+/)
      .map((t) => t.replace(/[^a-zA-Z0-9._/-]/g, ''))
      .filter((t) => t.length > 2);

    for (const t of tokens) {
      mentions.add(t.toLowerCase());
    }

    // Also add tool call IDs from toolCalls array
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        mentions.add(tc.id.toLowerCase());
        mentions.add(tc.name.toLowerCase());
        // Extract string args values as keywords
        for (const v of Object.values(tc.args)) {
          if (typeof v === 'string' && v.length > 2) {
            mentions.add(v.toLowerCase());
            // Also add filename portion of paths
            const base = v.split(/[/\\]/).pop();
            if (base && base.length > 2) mentions.add(base.toLowerCase());
          }
        }
      }
    }

    // If it's a tool result, also add the tool call ID for correlation
    if (msg.toolCallId) {
      mentions.add(msg.toolCallId.toLowerCase());
    }
    if (msg.name) {
      mentions.add(msg.name.toLowerCase());
    }
  }

  return mentions;
}

/**
 * Check if a tool result message has any content tokens that appear in recentMentions.
 * Extracts filenames, paths, and significant keywords from the content.
 */
function isContentReferenced(msg: ConversationMessage, recentMentions: Set<string>): boolean {
  // Always consider referenced if the tool call ID is mentioned
  if (msg.toolCallId && recentMentions.has(msg.toolCallId.toLowerCase())) return true;
  if (msg.name && recentMentions.has(msg.name.toLowerCase())) return true;

  // Extract file-like tokens from the tool content
  const contentTokens = msg.content
    .split(/\s+/)
    .map((t) => t.replace(/[^a-zA-Z0-9._/-]/g, ''))
    .filter((t) => t.length > 3 && (t.includes('.') || t.includes('/')));

  for (const token of contentTokens) {
    const lower = token.toLowerCase();
    if (recentMentions.has(lower)) return true;
    // Also check just the filename portion
    const base = lower.split(/[/\\]/).pop();
    if (base && base.length > 3 && recentMentions.has(base)) return true;
  }

  return false;
}

/**
 * Try to extract a meaningful short arg summary from the tool message.
 * Uses the tool call correlating message if possible; falls back to content snippet.
 */
function extractArgsHint(msg: ConversationMessage): string {
  // If the content starts with a path or short identifier, use that
  const firstLine = msg.content.split('\n')[0]?.trim() ?? '';
  if (firstLine.length > 0 && firstLine.length < 60) {
    return firstLine.slice(0, 50);
  }
  return '...';
}
