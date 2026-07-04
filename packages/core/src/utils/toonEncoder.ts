// ─── TOON Encoder ─────────────────────────────────────────────────────────────
// Encodes tool result payloads using the @toon-format/toon library when the
// result is a uniform array of objects. Falls back to JSON/string for all other shapes.
//
// TOON gives ~40-60% token reduction on uniform arrays (list_directory, search results).
// For non-uniform or small arrays, falls back to plain JSON — always safe.

import { encode } from '@toon-format/toon';

/**
 * Encodes a tool result as a compact TOON format when applicable.
 * - Uniform arrays of objects → TOON header + rows (token-efficient)
 * - All other shapes → JSON.stringify / passthrough string
 */
export function encodeToolResult(result: unknown): string {
  if (
    Array.isArray(result) &&
    result.length > 3 &&
    typeof result[0] === 'object' &&
    result[0] !== null &&
    isUniform(result as object[])
  ) {
    try {
      return encode(result as Record<string, unknown>[]);
    } catch {
      return JSON.stringify(result);
    }
  }
  return typeof result === 'string' ? result : JSON.stringify(result);
}

/**
 * Check whether all items in the array share the same set of keys.
 * If any object has a differing key set, it's not uniform and we fall back.
 */
function isUniform(arr: object[]): boolean {
  const keys = Object.keys(arr[0]!).sort().join(',');
  return arr.every((item) => Object.keys(item).sort().join(',') === keys);
}
