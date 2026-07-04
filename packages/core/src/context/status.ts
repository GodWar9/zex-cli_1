// ─── Context status for /context slash command ───────────────────────────────

import type { ConversationMessage } from '../agent/types.ts';
import { countTokens } from '../utils/tokens.ts';
import { DEFAULT_TOKEN_BUDGET } from '../config/defaults.ts';
import { gc } from '../agent/gcState.ts';
import { dualCache } from '../cache/index.ts';
import { memoryCount } from '../session/memory.ts';

export function buildContextReport(history: ConversationMessage[]): string {
  const byRole: Record<string, { count: number; tokens: number }> = {};

  for (const m of history) {
    const role = m.role;
    if (!byRole[role]) byRole[role] = { count: 0, tokens: 0 };
    byRole[role]!.count++;
    byRole[role]!.tokens += countTokens(m.content ?? '');
  }

  const totalTokens = Object.values(byRole).reduce((s, r) => s + r.tokens, 0);
  const budget = DEFAULT_TOKEN_BUDGET;
  const hitRate = (dualCache.getHitRate() * 100).toFixed(0);

  const lines = [
    'Context Composition:',
    '',
    `  Total messages: ${history.length}`,
    `  Total tokens:   ${totalTokens} / ${budget.available} available`,
    '',
    '  By role:',
  ];

  for (const [role, stats] of Object.entries(byRole)) {
    lines.push(`    ${role.padEnd(12)} ${String(stats.count).padStart(3)} msgs  ${String(stats.tokens).padStart(6)} tokens`);
  }

  lines.push(
    '',
    '  Budget allocation:',
    `    history:      ${budget.allocation.history}`,
    `    crossFile:    ${budget.allocation.crossFile}`,
    `    memory:       ${budget.allocation.memory} (${memoryCount()} stored)`,
    `    openFiles:    ${budget.allocation.openFiles}`,
    `    currentTask:  ${budget.allocation.currentTask}`,
    '',
    `  GC store: ${gc.getStoreSize()} chunks`,
    `  Cache hit rate: ${hitRate}%`,
  );

  return lines.join('\n');
}
