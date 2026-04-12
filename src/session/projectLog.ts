// ─── Project Log ─────────────────────────────────────────────────────────────
// Automatically maintains a project.md file in the working directory.
// After every successful turn, zex appends:
//   - What the user asked
//   - What zex responded
//   - Which tools were invoked (files created/read, commands run, etc.)
//
// The file is human-readable markdown and acts as a persistent project diary.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LOG_FILE = 'project.md';

export interface TurnRecord {
  userMessage: string;
  assistantResponse: string;
  toolsUsed: { name: string; args: Record<string, any> }[];
  timestamp: string;
}

/**
 * Initialises project.md if it doesn't exist yet.
 */
function ensureLogFile(cwd: string): void {
  const logPath = join(cwd, LOG_FILE);
  if (!existsSync(logPath)) {
    const header = `# Project Log\n\n> Automatically maintained by zex. Every conversation turn is recorded here so nothing is ever lost.\n\n---\n`;
    writeFileSync(logPath, header, 'utf-8');
  }
}

/**
 * Formats a single turn into a markdown section and appends it to project.md.
 */
export function appendTurnToLog(turn: TurnRecord): void {
  const cwd = process.cwd();
  ensureLogFile(cwd);

  const logPath = join(cwd, LOG_FILE);

  const toolSection =
    turn.toolsUsed.length > 0
      ? `\n**Tools used:**\n${turn.toolsUsed
          .map((t) => {
            const argStr = Object.entries(t.args)
              .map(([k, v]) => `${k}: \`${String(v).slice(0, 120)}\``)
              .join(', ');
            return `- \`${t.name}\`${argStr ? ` — ${argStr}` : ''}`;
          })
          .join('\n')}\n`
      : '';

  const entry = `
## ${turn.timestamp}

**You asked:**
> ${turn.userMessage.split('\n').join('\n> ')}

**Zex responded:**
${turn.assistantResponse.trim()}
${toolSection}
---
`;

  const existing = readFileSync(logPath, 'utf-8');
  writeFileSync(logPath, existing + entry, 'utf-8');
}

/**
 * Convenience: build a TurnRecord from raw runner data.
 */
export function buildTurnRecord(
  userMessage: string,
  assistantResponse: string,
  toolsUsed: { name: string; args: Record<string, any> }[],
): TurnRecord {
  return {
    userMessage,
    assistantResponse,
    toolsUsed,
    timestamp: new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };
}
