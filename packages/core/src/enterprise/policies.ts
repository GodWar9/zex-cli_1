// ─── Org policy enforcement ─────────────────────────────────────────────────

import { loadOrgConfig } from './orgConfig.ts';
import { writeAudit } from './auditLog.ts';
import { budgetTracker } from '../session/budget.ts';

export interface PolicyCheck {
  allowed: boolean;
  reason?: string;
}

/** Check if a tool call is allowed by org policy. */
export function checkToolPolicy(toolName: string, args: Record<string, unknown>): PolicyCheck {
  const org = loadOrgConfig();
  const policies = org.policies;

  if (budgetTracker.isOverCap()) {
    writeAudit({
      category: 'budget',
      action: 'blocked',
      resource: toolName,
      details: { reason: 'budget_cap_exceeded' },
      severity: 'warning',
    });
    return { allowed: false, reason: 'Session budget cap exceeded. Increase cap in ~/.zex/org.json or /stats --budget.' };
  }

  if (toolName === 'run_shell_command' && policies.blockedShellPatterns?.length) {
    const cmd = String(args['command'] ?? '');
    for (const pattern of policies.blockedShellPatterns) {
      if (cmd.includes(pattern)) {
        writeAudit({
          category: 'security',
          action: 'shell_blocked',
          resource: cmd.slice(0, 100),
          details: { pattern },
          severity: 'critical',
        });
        return { allowed: false, reason: `Shell command blocked by org policy (matches: ${pattern})` };
      }
    }
  }

  if ((toolName === 'write_file' || toolName === 'patch_file') && policies.allowedWriteExtensions?.length) {
    const path = String(args['path'] ?? '');
    const ext = path.includes('.') ? '.' + path.split('.').pop() : '';
    if (ext && !policies.allowedWriteExtensions.includes(ext)) {
      return { allowed: false, reason: `File extension ${ext} not allowed by org policy.` };
    }
  }

  return { allowed: true };
}

/** Whether org requires approval for this tool (may stack with default TUI gate). */
export function requiresOrgApproval(toolName: string): boolean {
  const org = loadOrgConfig();
  return (org.policies.requireApprovalFor ?? []).includes(toolName);
}
