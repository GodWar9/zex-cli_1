/// <reference types="bun-types" />
// ─── Garbage Collector: reference counting + lease eviction ───────────────────
// Tracks chunk lifetimes across context builds. Integrates with compressHistory.

export interface GCChunk {
  id: string;
  content: string;
  timestamp: number;
  pinned?: boolean;
}

class GarbageCollector {
  private refCounts = new Map<string, number>();
  private store = new Map<string, GCChunk>();
  private leaseTime = new Map<string, number>();

  addRef(chunkId: string, chunk?: GCChunk): void {
    this.refCounts.set(chunkId, (this.refCounts.get(chunkId) ?? 0) + 1);
    if (chunk) this.store.set(chunkId, chunk);
  }

  releaseRef(chunkId: string): void {
    const count = (this.refCounts.get(chunkId) ?? 1) - 1;
    if (count <= 0) this.refCounts.delete(chunkId);
    else this.refCounts.set(chunkId, count);
  }

  scheduleEviction(chunkId: string, ttlMs: number): void {
    this.leaseTime.set(chunkId, Date.now() + ttlMs);
  }

  evictExpired(): number {
    const now = Date.now();
    let evicted = 0;
    for (const [id, expiry] of this.leaseTime.entries()) {
      if (now > expiry && (this.refCounts.get(id) ?? 0) === 0) {
        this.store.delete(id);
        this.leaseTime.delete(id);
        evicted++;
      }
    }
    return evicted;
  }

  getStoreSize(): number {
    return this.store.size;
  }

  /** Start background eviction loop (every 5 min per spec). */
  startBackgroundEviction(intervalMs = 5 * 60 * 1000): ReturnType<typeof setInterval> {
    return setInterval(() => this.evictExpired(), intervalMs);
  }
}

export const gc = new GarbageCollector();
