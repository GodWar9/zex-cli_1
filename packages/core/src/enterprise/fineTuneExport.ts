// ─── Fine-tuning dataset export (Q4) ─────────────────────────────────────────
// Exports user corrections and session pairs as JSONL for model fine-tuning.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConversationMessage } from '../agent/types.ts';
import { listMemories } from '../session/memory.ts';
import { analyzeProjectStyle } from '../context/styleGuide.ts';

export interface FineTuneRecord {
  messages: Array<{ role: string; content: string }>;
  metadata: {
    source: 'session' | 'memory' | 'style';
    timestamp: string;
  };
}

/** Build fine-tuning records from conversation history. */
export function buildFineTuneRecords(history: ConversationMessage[]): FineTuneRecord[] {
  const records: FineTuneRecord[] = [];

  for (let i = 0; i < history.length - 1; i++) {
    const user = history[i];
    const assistant = history[i + 1];
    if (user?.role === 'user' && assistant?.role === 'assistant' && assistant.content) {
      records.push({
        messages: [
          { role: 'user', content: user.content },
          { role: 'assistant', content: assistant.content },
        ],
        metadata: { source: 'session', timestamp: new Date().toISOString() },
      });
    }
  }

  // Memories as preference injections
  for (const mem of listMemories()) {
    records.push({
      messages: [
        { role: 'system', content: 'Apply this project preference in all responses.' },
        { role: 'user', content: `Remember: ${mem.text}` },
        { role: 'assistant', content: `Understood. I will follow: ${mem.text}` },
      ],
      metadata: { source: 'memory', timestamp: new Date(mem.timestamp).toISOString() },
    });
  }

  // Style guide as system hint
  const style = analyzeProjectStyle();
  records.push({
    messages: [
      { role: 'system', content: `Project conventions: ${JSON.stringify(style)}` },
      { role: 'user', content: 'Follow these conventions in all code you write.' },
      { role: 'assistant', content: `I will use ${style.namingConvention} naming, ${style.importStyle}, and ${style.errorHandling} for errors.` },
    ],
    metadata: { source: 'style', timestamp: new Date().toISOString() },
  });

  return records;
}

export function exportFineTuneDataset(
  history: ConversationMessage[],
  sessionId: string,
): string {
  const records = buildFineTuneRecords(history);
  const outPath = join(process.cwd(), `zex-finetune-${sessionId}.jsonl`);
  writeFileSync(
    outPath,
    records.map((r) => JSON.stringify(r)).join('\n') + '\n',
    'utf-8',
  );
  return outPath;
}
