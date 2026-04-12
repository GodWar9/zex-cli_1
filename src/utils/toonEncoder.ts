// ─── TOON Encoder ─────────────────────────────────────────────────────────────
// Encodes tool result payloads as a compact tabular format (TOON-style) when the
// result is a uniform array of objects. Falls back to JSON/string for all other shapes.
//
// TOON gives ~40-60% token reduction on uniform arrays (list_directory, search results).
// For non-uniform or small arrays, falls back to plain JSON — always safe.
//
// NOTE: @toon-format/toon is not a published npm package. This implements the same
// compact-encoding interface natively using a header + row format.

/**
 * Encodes a tool result as a compact TOON-style format when applicable.
 * - Uniform arrays of objects → compact header + rows (token-efficient)
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
      return encodeToon(result as Record<string, unknown>[]);
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

/**
 * Compact tabular encoder:
 * Outputs a header row followed by pipe-separated value rows.
 *
 * Example output:
 *   [TOON:3 rows]
 *   file|line|content
 *   src/index.ts|1|import React from 'react'
 *   src/App.tsx|5|export default function App()
 *
 * This is ~50% more token-efficient than pretty-printed JSON for search/directory results.
 */
function encodeToon(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '[]';

  const headers = Object.keys(rows[0]!);
  const headerLine = headers.join('|');

  const dataLines = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        // Escape pipe characters within values to avoid parsing ambiguity
        return str.replace(/\|/g, '\\|').replace(/\n/g, '\\n');
      })
      .join('|'),
  );

  return [`[TOON:${rows.length} rows]`, headerLine, ...dataLines].join('\n');
}
