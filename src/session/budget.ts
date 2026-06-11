// ─── Session Budget Tracker (Q2 cost tracking) ───────────────────────────────

import { DEFAULT_TOKEN_BUDGET } from '../config/defaults.ts';
import { loadOrgConfig } from '../enterprise/orgConfig.ts';
import { writeAudit } from '../enterprise/auditLog.ts';

const COST_PER_1K_INPUT = 0.0001;
const COST_PER_1K_OUTPUT = 0.0004;

class BudgetTracker {
  private spentUsd = 0;
  private sessionBudgetUsd = 0.5;
  private byAgent: Record<string, number> = {};
  private warned = false;

  constructor() {
    this.syncFromOrg();
  }

  syncFromOrg(): void {
    const cap = loadOrgConfig().policies.budgetCapUsd;
    this.sessionBudgetUsd = cap && cap > 0 ? cap : 0.5;
  }

  trackUsage(inputTokens: number, outputTokens: number, agent = 'main'): void {
    const cost =
      (inputTokens / 1000) * COST_PER_1K_INPUT +
      (outputTokens / 1000) * COST_PER_1K_OUTPUT;
    this.spentUsd += cost;
    this.byAgent[agent] = (this.byAgent[agent] ?? 0) + cost;

    if (this.warning && !this.warned) {
      this.warned = true;
      writeAudit({
        category: 'budget',
        action: 'low_budget_warning',
        details: { remaining: this.remaining, spent: this.spentUsd },
        severity: 'warning',
      });
    }

    if (this.isOverCap()) {
      writeAudit({
        category: 'budget',
        action: 'cap_exceeded',
        details: { spent: this.spentUsd, cap: this.sessionBudgetUsd },
        severity: 'critical',
      });
    }
  }

  setBudget(usd: number): void {
    this.sessionBudgetUsd = usd;
  }

  get remaining(): number {
    return Math.max(0, this.sessionBudgetUsd - this.spentUsd);
  }

  get warning(): boolean {
    return this.remaining < this.sessionBudgetUsd * 0.2;
  }

  isOverCap(): boolean {
    const cap = loadOrgConfig().policies.budgetCapUsd;
    if (cap && cap > 0) return this.spentUsd >= cap;
    return false;
  }

  get spent(): number {
    return this.spentUsd;
  }

  formatReport(): string {
    const pct = ((this.spentUsd / this.sessionBudgetUsd) * 100).toFixed(0);
    const status = this.isOverCap() ? '🛑 CAP EXCEEDED' : this.warning ? '⚠ LOW' : '✓ OK';
    const agentLines = Object.entries(this.byAgent)
      .map(([name, cost]) => `  ${name}: $${cost.toFixed(4)} (${((cost / (this.spentUsd || 1)) * 100).toFixed(0)}%)`)
      .join('\n');

    return [
      'Session Budget:',
      `  Allocated: $${this.sessionBudgetUsd.toFixed(2)}`,
      `  Used:      $${this.spentUsd.toFixed(4)} (${pct}%)`,
      `  Remaining: $${this.remaining.toFixed(4)} ${status}`,
      `  Token cap: ${DEFAULT_TOKEN_BUDGET.available.toLocaleString()}`,
      '',
      'By agent:',
      agentLines || '  (none yet)',
    ].join('\n');
  }
}

export const budgetTracker = new BudgetTracker();
