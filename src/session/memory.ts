// ─── Persistent Memory Store ──────────────────────────────────────────────────
// Local JSON-backed memories for /remember and /recall slash commands.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface Memory {
  id: string;
  text: string;
  timestamp: number;
  vector: Record<string, number>;
}

const MEMORY_PATH = join(homedir(), '.zex', 'memory.json');

function vectorize(text: string): Record<string, number> {
  const vec: Record<string, number> = {};
  for (const w of text.toLowerCase().split(/\W+/).filter((t) => t.length > 2)) {
    vec[w] = (vec[w] ?? 0) + 1;
  }
  return vec;
}

function cosine(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const v of Object.values(a)) normA += v * v;
  for (const v of Object.values(b)) normB += v * v;
  for (const [k, va] of Object.entries(a)) {
    const vb = b[k];
    if (vb) dot += va * vb;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function loadAll(): Memory[] {
  try {
    if (!existsSync(MEMORY_PATH)) return [];
    return JSON.parse(readFileSync(MEMORY_PATH, 'utf-8')) as Memory[];
  } catch {
    return [];
  }
}

function saveAll(memories: Memory[]): void {
  const dir = join(homedir(), '.zex');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(MEMORY_PATH, JSON.stringify(memories, null, 2), 'utf-8');
}

/** Add a new memory entry. */
export function remember(text: string): Memory {
  const memories = loadAll();
  const entry: Memory = {
    id: `mem-${Date.now()}`,
    text,
    timestamp: Date.now(),
    vector: vectorize(text),
  };
  memories.push(entry);
  saveAll(memories);
  return entry;
}

/** Search memories by semantic similarity to query. */
export function recall(query: string, limit = 5): Memory[] {
  const queryVec = vectorize(query);
  return loadAll()
    .map((m) => ({ m, score: cosine(queryVec, m.vector) }))
    .filter((x) => x.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.m);
}

/** Format memories for injection into system prompt. */
export function formatMemoriesForPrompt(query: string, budget = 500): string {
  const hits = recall(query, 3);
  if (hits.length === 0) return '';
  const lines = ['## Persistent Memory', ...hits.map((h) => `- ${h.text}`)];
  const text = lines.join('\n');
  return text.length > budget * 4 ? text.slice(0, budget * 4) : text;
}

export function listMemories(): Memory[] {
  return loadAll();
}

export function memoryCount(): number {
  return loadAll().length;
}

/** Merge near-duplicate memories (similarity > 0.85). */
export function clusterMemories(): number {
  const memories = loadAll();
  if (memories.length < 3) return 0;

  const merged: Memory[] = [];
  const used = new Set<string>();
  let clusters = 0;

  for (let i = 0; i < memories.length; i++) {
    const a = memories[i]!;
    if (used.has(a.id)) continue;

    const cluster = [a];
    for (let j = i + 1; j < memories.length; j++) {
      const b = memories[j]!;
      if (used.has(b.id)) continue;
      if (cosine(a.vector, b.vector) > 0.85) {
        cluster.push(b);
        used.add(b.id);
      }
    }

    if (cluster.length > 1) {
      clusters++;
      const combined = cluster.map((m) => m.text).join('; ');
      merged.push({
        id: a.id,
        text: combined.slice(0, 300),
        timestamp: Math.max(...cluster.map((m) => m.timestamp)),
        vector: vectorize(combined),
      });
      used.add(a.id);
    } else {
      merged.push(a);
      used.add(a.id);
    }
  }

  if (clusters > 0) saveAll(merged);
  return clusters;
}
