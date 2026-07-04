// ─── Session Export ───────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConversationMessage } from '../agent/types.ts';

export function exportSessionMarkdown(
  messages: ConversationMessage[],
  sessionId: string,
): string {
  const lines = [
    `# ZEX Session Export`,
    `Session: ${sessionId}`,
    `Exported: ${new Date().toISOString()}`,
    '',
    '---',
    '',
  ];

  for (const m of messages) {
    if (m.role === 'system') continue;
    const label = m.role === 'tool' ? `Tool (${m.name ?? 'unknown'})` : m.role;
    lines.push(`## ${label}`, '', m.content ?? '', '');
    if (m.toolCalls?.length) {
      for (const tc of m.toolCalls) {
        lines.push(`> Tool call: \`${tc.name}\`(${JSON.stringify(tc.args).slice(0, 100)})`, '');
      }
    }
  }

  const md = lines.join('\n');
  const outPath = join(process.cwd(), `zex-export-${sessionId}.md`);
  writeFileSync(outPath, md, 'utf-8');
  return outPath;
}
