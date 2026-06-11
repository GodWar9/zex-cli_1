// ─── Dual Cache: exact (LRU) + semantic (bag-of-words similarity) ─────────────

import { createHash } from 'node:crypto';
import { metrics } from '../session/metrics.ts';

export interface CacheHit {
  text: string;
  source: 'exact' | 'semantic';
}

interface CacheEntry {
  response: string;
  timestamp: number;
  ttl: number;
  query: string;
  vector: Map<string, number>;
}

const SEMANTIC_THRESHOLD = 0.92;

function embed(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const w of text.toLowerCase().split(/\W+/).filter((t) => t.length > 2)) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return freq;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
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

function hashQuery(query: string, contextPaths: string[], model: string): string {
  const key = [query, contextPaths.sort().join('|'), model].join(':::');
  return createHash('sha256').update(key).digest('hex');
}

class DualCache {
  private exact = new Map<string, CacheEntry>();
  private semantic: CacheEntry[] = [];
  private filePrefixes = new Map<string, Set<string>>(); // filePath -> hash keys

  get(query: string, contextPaths: string[], model: string): CacheHit | null {
    const now = Date.now();
    const hash = hashQuery(query, contextPaths, model);

    const exact = this.exact.get(hash);
    if (exact && now - exact.timestamp < exact.ttl * 1000) {
      metrics.recordCacheHit('exact');
      return { text: exact.response, source: 'exact' };
    }

    const queryVec = embed(query);
    let best: CacheEntry | null = null;
    let bestScore = 0;

    for (const entry of this.semantic) {
      if (now - entry.timestamp >= entry.ttl * 1000) continue;
      const sim = cosine(queryVec, entry.vector);
      if (sim >= SEMANTIC_THRESHOLD && sim > bestScore) {
        best = entry;
        bestScore = sim;
      }
    }

    if (best) {
      metrics.recordCacheHit('semantic');
      return { text: best.response, source: 'semantic' };
    }

    metrics.recordCacheMiss();
    return null;
  }

  set(
    query: string,
    response: string,
    contextPaths: string[],
    model: string,
    ttl = 3600,
  ): void {
    const hash = hashQuery(query, contextPaths, model);
    const vector = embed(query);
    const entry: CacheEntry = { response, timestamp: Date.now(), ttl, query, vector };

    this.exact.set(hash, entry);
    this.semantic.push(entry);
    if (this.semantic.length > 200) this.semantic.shift();

    for (const p of contextPaths) {
      if (!this.filePrefixes.has(p)) this.filePrefixes.set(p, new Set());
      this.filePrefixes.get(p)!.add(hash);
    }
  }

  invalidateForFile(filePath: string): void {
    const keys = this.filePrefixes.get(filePath);
    if (!keys) return;
    for (const k of keys) this.exact.delete(k);
    this.filePrefixes.delete(filePath);
  }

  getHitRate(): number {
    const total = metrics.cacheHitsExact + metrics.cacheHitsSemantic + metrics.cacheMisses;
    if (total === 0) return 0;
    return (metrics.cacheHitsExact + metrics.cacheHitsSemantic) / total;
  }

  clear(): void {
    this.exact.clear();
    this.semantic = [];
    this.filePrefixes.clear();
  }
}

export const dualCache = new DualCache();
