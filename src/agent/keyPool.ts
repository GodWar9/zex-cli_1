// ─── Gemini Key Pool ─────────────────────────────────────────────────────────
// Manages a pool of Gemini API keys with cooldown rotation.
// When a key hits a 429 quota error, it is put on cooldown and the next
// available key is used automatically.
//
// Config sources (in priority order):
//   1. apiKeys[] array in ~/.zex/config.json
//   2. GEMINI_API_KEYS env var (comma-separated list)
//   3. GEMINI_API_KEY / GOOGLE_API_KEY env var (single key — wrapped as pool of 1)

const COOLDOWN_MS = 60_000; // 60 seconds before a key is retried after a 429

interface KeyEntry {
  key: string;
  cooldownUntil: number; // epoch ms — 0 means available now
  errorCount: number;
}

export class KeyPool {
  private entries: KeyEntry[];
  private currentIndex: number = 0;

  constructor(keys: string[]) {
    if (keys.length === 0) {
      throw new Error('KeyPool requires at least one API key.');
    }
    this.entries = keys.map((k) => ({ key: k.trim(), cooldownUntil: 0, errorCount: 0 }));
  }

  // ─── Static factory ────────────────────────────────────────────────────────

  /** Build a KeyPool from config or environment variables. */
  static fromEnv(configKeys?: string[]): KeyPool {
    // 1. Explicit array from config file
    if (configKeys && configKeys.length > 0) {
      return new KeyPool(configKeys);
    }

    // 2. GEMINI_API_KEYS env var (comma-separated)
    const poolEnv = process.env['GEMINI_API_KEYS'];
    if (poolEnv) {
      const keys = poolEnv.split(',').map((k) => k.trim()).filter(Boolean);
      if (keys.length > 0) return new KeyPool(keys);
    }

    // 3. Single key fallback
    const singleKey =
      process.env['GEMINI_API_KEY'] ??
      process.env['GOOGLE_API_KEY'];
    if (singleKey) {
      return new KeyPool([singleKey]);
    }

    throw new Error(
      'No Gemini API keys found. Set GEMINI_API_KEYS (comma-separated) or GEMINI_API_KEY in .env or ~/.zex/config.json'
    );
  }

  // ─── Key access ───────────────────────────────────────────────────────────

  /** Get the current active key. Returns null if all keys are on cooldown. */
  getCurrentKey(): string | null {
    const now = Date.now();
    // Try rotating from current index to find an available key
    for (let i = 0; i < this.entries.length; i++) {
      const idx = (this.currentIndex + i) % this.entries.length;
      const entry = this.entries[idx]!;
      if (entry.cooldownUntil <= now) {
        this.currentIndex = idx;
        return entry.key;
      }
    }
    return null; // All keys are on cooldown
  }

  /**
   * Call when a key returns a 429 (quota exhausted).
   * Puts the key on cooldown and advances to the next available key.
   * Returns the new active key, or null if all are exhausted.
   */
  markExhausted(key: string): string | null {
    const entry = this.entries.find((e) => e.key === key);
    if (entry) {
      entry.cooldownUntil = Date.now() + COOLDOWN_MS;
      entry.errorCount++;
    }
    // Advance past this key
    this.currentIndex = (this.currentIndex + 1) % this.entries.length;
    return this.getCurrentKey();
  }

  /**
   * Returns true if at least one key is currently available (not on cooldown).
   */
  hasAvailableKey(): boolean {
    return this.getCurrentKey() !== null;
  }

  /**
   * Returns how many milliseconds until the next key comes off cooldown.
   * Returns 0 if a key is available now.
   */
  msUntilNextAvailable(): number {
    const now = Date.now();
    if (this.hasAvailableKey()) return 0;
    const earliest = Math.min(...this.entries.map((e) => e.cooldownUntil));
    return Math.max(0, earliest - now);
  }

  // ─── Status / display ─────────────────────────────────────────────────────

  /** Masked key for display — shows first 8 and last 4 characters. */
  static maskKey(key: string): string {
    if (key.length <= 12) return '***';
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  }

  /** Full pool status for display in StatusBar or error messages. */
  status(): Array<{ masked: string; state: 'active' | 'cooldown' | 'current'; cooldownEndsAt?: number; errorCount: number }> {
    const now = Date.now();
    const currentKey = this.getCurrentKey();
    return this.entries.map((e) => ({
      masked: KeyPool.maskKey(e.key),
      state: e.cooldownUntil > now ? 'cooldown' : e.key === currentKey ? 'current' : 'active',
      cooldownEndsAt: e.cooldownUntil > now ? e.cooldownUntil : undefined,
      errorCount: e.errorCount,
    }));
  }

  /** Human-readable summary line, e.g. "Keys: 14 active, 2 on cooldown" */
  summaryLine(): string {
    const now = Date.now();
    const onCooldown = this.entries.filter((e) => e.cooldownUntil > now).length;
    const active = this.entries.length - onCooldown;
    if (onCooldown === 0) return `${active} key${active !== 1 ? 's' : ''} available`;
    return `${active} active, ${onCooldown} on cooldown (60s)`;
  }

  get totalKeys(): number {
    return this.entries.length;
  }

  /** Returns 1-based index of the given key in the pool. */
  getKeyIndex(key: string): number {
    const idx = this.entries.findIndex((e) => e.key === key);
    return idx === -1 ? 0 : idx + 1;
  }
}
