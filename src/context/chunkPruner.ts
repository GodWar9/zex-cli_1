// ─── Semantic + Recency Chunk Pruner ─────────────────────────────────────────
// Scores conversation chunks by relevance, recency, and importance, then
// greedily packs them within a token budget.

import type { ConversationMessage } from '../agent/types.ts';
import { countTokens } from '../utils/tokens.ts';
import { DEFAULT_TOKEN_BUDGET } from '../config/defaults.ts';

export type ChunkType = 'file' | 'turn' | 'memory' | 'tool';

export interface ContextChunk {
  id: string;
  type: ChunkType;
  content: string;
  tokens: number;
  timestamp: number;
  pinned?: boolean;
  lastReferenced: number;
}

export interface ChunkScore extends ContextChunk {
  relevance: number;
  recency: number;
  importance: number;
  score: number;
}

const MAX_AGE_MS = 30 * 60 * 1000; // 30 min recency window

/** Bag-of-words cosine similarity — offline, no embedding API required. */
function tokenize(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const w of text.toLowerCase().split(/\W+/).filter((t) => t.length > 2)) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return freq;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [, v] of a) normA += v * v;
  for (const [, v] of b) normB += v * v;
  for (const [k, va] of a) {
    const vb = b.get(k);
    if (vb) dot += va * vb;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function scoreChunk(chunk: ContextChunk, task: string, now: number): ChunkScore {
  const taskVec = tokenize(task);
  const chunkVec = tokenize(chunk.content);
  const relevance = cosineSimilarity(taskVec, chunkVec);
  const recency = Math.max(0, 1 - (now - chunk.timestamp) / MAX_AGE_MS);
  const importance = chunk.pinned ? 1 : 0.5;
  const lastRef = Math.max(0, now - chunk.lastReferenced) / 1000;
  const score =
    relevance * 0.5 +
    recency * 0.3 +
    (chunk.pinned ? 0.2 : 0.1) -
    lastRef * 0.05;

  return { ...chunk, relevance, recency, importance, score };
}

/** Convert conversation messages into scorable chunks. */
export function messagesToChunks(
  messages: ConversationMessage[],
  pinFiles: string[] = [],
): ContextChunk[] {
  const now = Date.now();
  const nonSystem = messages.filter((m) => m.role !== 'system');
  return nonSystem.map((m, i) => {
    const content = m.content ?? '';
    const mentionsPinnedFile = pinFiles.some(
      (f) => content.includes(f) || content.includes(f.split('/').pop() ?? ''),
    );
    const isRecent = i >= nonSystem.length - 5;
    return {
      id: `turn-${i}`,
      type: (m.role === 'tool' ? 'tool' : 'turn') as ChunkType,
      content,
      tokens: countTokens(content),
      timestamp: now - (nonSystem.length - i) * 1000,
      lastReferenced: now,
      pinned: mentionsPinnedFile || isRecent,
    };
  });
}

export interface PruneResult {
  kept: ContextChunk[];
  dropped: ContextChunk[];
  tokensUsed: number;
  tokensBudget: number;
}

/**
 * Prune chunks to fit within token budget.
 * mustInclude IDs and recent window entries are never dropped.
 */
export function pruneChunks(
  chunks: ContextChunk[],
  task: string,
  budget: number = DEFAULT_TOKEN_BUDGET.available,
  constraints: {
    mustInclude?: string[];
    minRecencyWindowMs?: number;
  } = {},
): PruneResult {
  const now = Date.now();
  const mustInclude = new Set(constraints.mustInclude ?? []);
  const minWindow = constraints.minRecencyWindowMs ?? 10 * 60 * 1000;

  const scored = chunks.map((c) => scoreChunk(c, task, now));

  const core = scored.filter(
    (s) => mustInclude.has(s.id) || now - s.timestamp < minWindow,
  );
  const sortable = scored
    .filter((s) => !core.some((c) => c.id === s.id))
    .sort((a, b) => b.score - a.score);

  let tokenUsed = core.reduce((sum, s) => sum + s.tokens, 0);
  const kept: ContextChunk[] = [...core];
  const dropped: ContextChunk[] = [];

  for (const chunk of sortable) {
    if (tokenUsed + chunk.tokens <= budget) {
      kept.push(chunk);
      tokenUsed += chunk.tokens;
    } else {
      dropped.push(chunk);
    }
  }

  // Panic mode: if still over 90% budget, drop lowest-scored non-pinned chunks
  const panicThreshold = budget * 0.9;
  if (tokenUsed > panicThreshold) {
    const droppable = kept
      .filter((c) => !c.pinned)
      .sort((a, b) => a.tokens - b.tokens);
    for (const chunk of droppable) {
      if (tokenUsed <= panicThreshold) break;
      const idx = kept.findIndex((c) => c.id === chunk.id);
      if (idx >= 0) {
        kept.splice(idx, 1);
        tokenUsed -= chunk.tokens;
        dropped.push(chunk);
      }
    }
  }

  return { kept, dropped, tokensUsed: tokenUsed, tokensBudget: budget };
}

/** Rebuild message list from pruned chunks (preserves order by original id). */
export function chunksToMessages(
  original: ConversationMessage[],
  kept: ContextChunk[],
): ConversationMessage[] {
  const keptIds = new Set(kept.map((c) => c.id));
  const nonSystem = original.filter((m) => m.role !== 'system');
  return nonSystem.filter((_, i) => keptIds.has(`turn-${i}`));
}
