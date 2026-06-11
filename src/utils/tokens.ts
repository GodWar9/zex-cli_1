// ─── Exact token counting (js-tiktoken) ───────────────────────────────────────
// Never estimate — every budget decision uses precise counts per spec.

import { getEncoding, type Tiktoken } from 'js-tiktoken';

let _enc: Tiktoken | null = null;

function encoding(): Tiktoken {
  if (!_enc) _enc = getEncoding('cl100k_base');
  return _enc;
}

/** Count exact tokens for a string using cl100k_base (GPT-4 family). */
export function countTokens(text: string): number {
  if (!text) return 0;
  return encoding().encode(text).length;
}

/** Sum token counts for multiple strings. */
export function countTokensMany(parts: string[]): number {
  return parts.reduce((sum, p) => sum + countTokens(p), 0);
}
