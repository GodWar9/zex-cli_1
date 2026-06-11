// ─── Persistent audit log (JSONL) — Q4 advanced audit ───────────────────────

import { existsSync, mkdirSync, appendFileSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { AuditRecord } from './types.ts';
import { loadOrgConfig } from './orgConfig.ts';
import { getAuthSession } from './auth.ts';

const AUDIT_DIR = join(homedir(), '.zex', 'audit');
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB per file

let _sessionId = randomUUID();
let _turn = 0;

export function setAuditSession(sessionId: string): void {
  _sessionId = sessionId;
}

export function setAuditTurn(turn: number): void {
  _turn = turn;
}

function ensureDir(): void {
  if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });
}

function currentLogFile(): string {
  const date = new Date().toISOString().slice(0, 10);
  return join(AUDIT_DIR, `audit-${date}.jsonl`);
}

function rotateIfNeeded(file: string): void {
  try {
    if (existsSync(file) && statSync(file).size > MAX_FILE_BYTES) {
      const rotated = file.replace('.jsonl', `-${Date.now()}.jsonl`);
      appendFileSync(rotated, '');
    }
  } catch { /* skip */ }
}

function pruneOldLogs(): void {
  const retention = (loadOrgConfig().auditRetentionDays ?? 90) * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - retention;
  try {
    for (const f of readdirSync(AUDIT_DIR)) {
      const full = join(AUDIT_DIR, f);
      if (statSync(full).mtimeMs < cutoff) unlinkSync(full);
    }
  } catch { /* skip */ }
}

/** Append a structured audit record to disk. */
export function writeAudit(record: Omit<AuditRecord, 'id' | 'timestamp' | 'orgId' | 'userId' | 'sessionId' | 'turn'>): void {
  ensureDir();
  pruneOldLogs();

  const session = getAuthSession();
  const org = loadOrgConfig();
  const full: AuditRecord = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    orgId: org.orgId,
    userId: session?.userId ?? 'anonymous',
    sessionId: _sessionId,
    turn: _turn,
    ...record,
  };

  const file = currentLogFile();
  rotateIfNeeded(file);
  appendFileSync(file, JSON.stringify(full) + '\n', 'utf-8');
}

/** Read recent audit entries (newest last). */
export function readRecentAudit(limit = 50): AuditRecord[] {
  ensureDir();
  const records: AuditRecord[] = [];
  try {
    const files = readdirSync(AUDIT_DIR)
      .filter((f) => f.endsWith('.jsonl'))
      .sort()
      .reverse();
    for (const f of files) {
      const lines = readFileSync(join(AUDIT_DIR, f), 'utf-8').trim().split('\n').filter(Boolean);
      for (const line of lines.reverse()) {
        try {
          records.push(JSON.parse(line) as AuditRecord);
          if (records.length >= limit) return records.reverse();
        } catch { /* skip bad line */ }
      }
    }
  } catch { /* empty */ }
  return records.reverse();
}

export function formatAuditSummary(limit = 20): string {
  const records = readRecentAudit(limit);
  if (records.length === 0) return 'No persistent audit records yet.';

  const lines = [`Persistent Audit Log (${records.length} recent):`, ''];
  for (const r of records.slice(-limit)) {
    const sev = r.severity ? `[${r.severity.toUpperCase()}]` : '';
    lines.push(`  ${r.timestamp.slice(11, 19)} ${sev} ${r.category}/${r.action} ${r.resource ?? ''}`);
  }
  lines.push('', `Log dir: ${AUDIT_DIR}`);
  return lines.join('\n');
}

export function exportAuditJsonl(destPath: string): number {
  const records = readRecentAudit(10_000);
  writeFileSync(destPath, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
  return records.length;
}
