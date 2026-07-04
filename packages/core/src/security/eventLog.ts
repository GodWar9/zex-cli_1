// ─── Security Event Log ───────────────────────────────────────────────────────
// A simple in-memory append-only log of security events for the current session.
// Singleton — safe to import anywhere.

import type { SecurityFinding } from './scanner.ts';
import { writeAudit } from '../enterprise/auditLog.ts';
import { metrics } from '../session/metrics.ts';

export interface SecurityEvent {
  turn: number;
  tool: string;
  file: string;
  finding: SecurityFinding;
  action: 'blocked' | 'warned' | 'logged';
  timestamp: Date;
}

/** Singleton log for the session */
export const securityLog: SecurityEvent[] = [];

/** Append a new event to the session log */
export function logSecurityEvent(event: SecurityEvent): void {
  securityLog.push(event);

  if (event.action === 'blocked') metrics.writesBlocked++;
  if (event.finding.severity === 'critical' || event.finding.severity === 'high') {
    metrics.vulnerabilitiesFound++;
  }

  writeAudit({
    category: 'security',
    action: event.action,
    resource: event.file,
    details: {
      tool: event.tool,
      label: event.finding.label,
      line: event.finding.lineNumber,
      severity: event.finding.severity,
    },
    severity: event.action === 'blocked' ? 'critical' : event.action === 'warned' ? 'warning' : 'info',
  });
}

/** Turn counter — incremented by the runner so events have context */
let _currentTurn = 0;
export function incrementTurn(): void {
  _currentTurn++;
}
export function getCurrentTurn(): number {
  return _currentTurn;
}

/**
 * Returns a formatted summary string for TUI display.
 * Blocked events → red marker, warnings → yellow, logged → gray.
 * If no events, returns a clean "all clear" message.
 */
export function getSecuritySummary(): string {
  if (securityLog.length === 0) {
    return '✓ No security events this session.';
  }

  const lines: string[] = [
    `Security Events — ${securityLog.length} total this session:`,
    '',
  ];

  for (const event of securityLog) {
    const time = event.timestamp.toLocaleTimeString();
    const severityTag = event.finding.severity.toUpperCase();
    const lineRef = event.finding.lineNumber ? `:${event.finding.lineNumber}` : '';

    // Action indicators — these are plain text; the TUI colors them from the caller
    const actionMarker =
      event.action === 'blocked' ? '[BLOCKED]' :
      event.action === 'warned'  ? '[WARNING]' :
                                   '[LOGGED]';

    lines.push(
      `  ${actionMarker} [${severityTag}] ${event.finding.label}`,
      `    File: ${event.file}${lineRef}  |  Tool: ${event.tool}  |  Turn: ${event.turn}  |  ${time}`,
      `    → ${event.finding.matchedLine.slice(0, 100)}`,
      '',
    );
  }

  const blocked = securityLog.filter((e) => e.action === 'blocked').length;
  const warned  = securityLog.filter((e) => e.action === 'warned').length;
  const logged  = securityLog.filter((e) => e.action === 'logged').length;

  lines.push(`Summary: ${blocked} blocked  ${warned} warnings  ${logged} logged`);

  return lines.join('\n');
}
