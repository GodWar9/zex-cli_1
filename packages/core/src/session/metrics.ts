// ─── Session Metrics ──────────────────────────────────────────────────────────
// Tracks cache, tokens, agents, security, and GC stats for /stats display.

class Metrics {
  cacheHitsExact = 0;
  cacheHitsSemantic = 0;
  cacheMisses = 0;

  tokensInput = 0;
  tokensOutput = 0;
  tokensPruned = 0;

  agentInvocations: Record<string, number> = {};
  agentDurations: Record<string, number[]> = {};

  vulnerabilitiesFound = 0;
  secretsDetected = 0;
  writesBlocked = 0;

  compactionsRun = 0;
  bytesEvicted = 0;
  prunerRuns = 0;
  prunerTotalMs = 0;

  recordCacheHit(type: 'exact' | 'semantic'): void {
    if (type === 'exact') this.cacheHitsExact++;
    else this.cacheHitsSemantic++;
  }

  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  recordTokens(input: number, output: number): void {
    this.tokensInput += input;
    this.tokensOutput += output;
  }

  recordPrune(tokensBefore: number, tokensAfter: number, durationMs: number): void {
    this.tokensPruned += Math.max(0, tokensBefore - tokensAfter);
    this.prunerRuns++;
    this.prunerTotalMs += durationMs;
  }

  recordAgent(agent: string, durationMs: number): void {
    this.agentInvocations[agent] = (this.agentInvocations[agent] ?? 0) + 1;
    if (!this.agentDurations[agent]) this.agentDurations[agent] = [];
    this.agentDurations[agent]!.push(durationMs);
  }

  recordCompaction(bytesSaved: number): void {
    this.compactionsRun++;
    this.bytesEvicted += bytesSaved;
  }

  formatStats(): string {
    const cacheTotal = this.cacheHitsExact + this.cacheHitsSemantic + this.cacheMisses;
    const hitRate = cacheTotal > 0
      ? (((this.cacheHitsExact + this.cacheHitsSemantic) / cacheTotal) * 100).toFixed(0)
      : '0';
    const avgPrune = this.prunerRuns > 0
      ? Math.round(this.prunerTotalMs / this.prunerRuns)
      : 0;

    const agentLines = Object.entries(this.agentInvocations)
      .map(([name, count]) => {
        const durations = this.agentDurations[name] ?? [];
        const avg = durations.length
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0;
        return `  ${name}: ${count} runs, avg ${avg}ms`;
      })
      .join('\n');

    return [
      'Session Stats:',
      '',
      `Cache: ${this.cacheHitsExact} exact, ${this.cacheHitsSemantic} semantic, ${this.cacheMisses} misses (${hitRate}% hit rate)`,
      `Tokens: ${this.tokensInput} in / ${this.tokensOutput} out (${this.tokensPruned} pruned)`,
      `Pruner: ${this.prunerRuns} runs, avg ${avgPrune}ms`,
      `GC: ${this.compactionsRun} compactions, ${this.bytesEvicted} bytes evicted`,
      `Security: ${this.writesBlocked} blocks, ${this.vulnerabilitiesFound} vulns`,
      '',
      'Agents:',
      agentLines || '  (none yet)',
    ].join('\n');
  }
}

export const metrics = new Metrics();
