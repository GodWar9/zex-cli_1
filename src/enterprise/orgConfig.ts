// ─── Org-level settings (~/.zex/org.json) ───────────────────────────────────

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { OrgConfig } from './types.ts';

const ORG_PATH = join(homedir(), '.zex', 'org.json');

const DEFAULT_ORG: OrgConfig = {
  orgId: 'local',
  orgName: 'Local',
  auth: { provider: 'none', required: false },
  policies: {
    requireApprovalFor: ['write_file', 'patch_file', 'run_shell_command'],
    strictness: 'balanced',
    budgetCapUsd: 0,
  },
  auditRetentionDays: 90,
};

let _cached: OrgConfig | null = null;

export function loadOrgConfig(): OrgConfig {
  if (_cached) return _cached;
  try {
    if (existsSync(ORG_PATH)) {
      const raw = JSON.parse(readFileSync(ORG_PATH, 'utf-8')) as Partial<OrgConfig>;
      _cached = {
        ...DEFAULT_ORG,
        ...raw,
        auth: { ...DEFAULT_ORG.auth, ...raw.auth },
        policies: { ...DEFAULT_ORG.policies, ...raw.policies },
      };
      return _cached;
    }
  } catch { /* use defaults */ }
  _cached = DEFAULT_ORG;
  return _cached;
}

export function reloadOrgConfig(): OrgConfig {
  _cached = null;
  return loadOrgConfig();
}

export function orgConfigPath(): string {
  return ORG_PATH;
}

export function formatOrgSummary(): string {
  const org = loadOrgConfig();
  return [
    'Organization Settings:',
    `  ID:       ${org.orgId}`,
    `  Name:     ${org.orgName}`,
    `  Auth:     ${org.auth.provider}${org.auth.required ? ' (required)' : ''}`,
    `  Strictness: ${org.policies.strictness}`,
    `  Budget cap: ${org.policies.budgetCapUsd ? `$${org.policies.budgetCapUsd}` : 'unlimited'}`,
    `  Approval required: ${(org.policies.requireApprovalFor ?? []).join(', ') || 'none'}`,
    '',
    `Edit ${ORG_PATH} to change org policies.`,
  ].join('\n');
}
