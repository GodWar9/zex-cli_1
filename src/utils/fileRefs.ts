// ─── File Reference Parser ────────────────────────────────────────────────────
// Parses @file references typed in the InputBox chat prompt.
//
// Supported syntax:
//   @filename.ts                  → entire file
//   @src/tools/bash.ts            → entire file with path
//   @bash.ts:10-25                → lines 10 to 25
//   @bash.ts:10                   → single line 10
//
// The parser:
//  1. Finds all @... tokens in a message string
//  2. Resolves the file (fuzzy: tries exact path, then searches recursively)
//  3. Reads the specified lines
//  4. Returns: the inline context block + the cleaned message + metadata for display

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

export interface FileReference {
  /** The raw token matched in the message, e.g. "@bash.ts:10-25" */
  raw: string;
  /** Resolved absolute file path */
  resolvedPath: string;
  /** Display-friendly short path (relative to cwd) */
  displayPath: string;
  /** First line of selection (1-indexed) */
  startLine: number;
  /** Last line of selection (1-indexed) */
  endLine: number;
  /** Total lines in file */
  totalLines: number;
  /** The extracted content block */
  content: string;
}

export interface ParseResult {
  /** Original message with @refs stripped out (the "clean" prompt) */
  cleanMessage: string;
  /** All successfully resolved file references */
  refs: FileReference[];
  /** Tokens that could NOT be resolved (file not found) */
  failedRefs: string[];
  /** The full prompt to send to the LLM: context blocks + clean message */
  augmentedPrompt: string;
}

// ── Regex: matches @anything until whitespace, with optional :start-end ────────
// Examples: @file.ts  @src/tools/bash.ts:10-25  @index.tsx:42
const REF_PATTERN = /@([\w./\-]+?)(?::(\d+)(?:-(\d+))?)?(?=\s|$|[,;!?])/g;

const ALWAYS_IGNORE = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '__pycache__', 'coverage']);

/**
 * Recursively find a file by name (or partial path) under a root directory.
 * Returns the first match found (depth-first).
 */
function findFile(name: string, dir: string, depth = 0): string | null {
  if (depth > 6) return null;

  let items: string[];
  try { items = readdirSync(dir); } catch { return null; }

  for (const item of items) {
    if (ALWAYS_IGNORE.has(item)) continue;
    const fullPath = join(dir, item);
    let stat;
    try { stat = statSync(fullPath); } catch { continue; }

    if (stat.isDirectory()) {
      const found = findFile(name, fullPath, depth + 1);
      if (found) return found;
    } else {
      // Match if filename equals OR fullPath ends with the given name
      if (item === name || fullPath.endsWith(name) || fullPath.endsWith('/' + name)) {
        return fullPath;
      }
    }
  }
  return null;
}

/**
 * Resolve a file token to an absolute path.
 * Tries: exact path → cwd-relative path → recursive fuzzy search.
 */
function resolveFilePath(token: string, cwd: string): string | null {
  // 1. Exact absolute path
  if (existsSync(token)) return token;

  // 2. Relative to cwd
  const cwdRelative = join(cwd, token);
  if (existsSync(cwdRelative)) return cwdRelative;

  // 3. Fuzzy: find by filename anywhere in the project
  const byName = findFile(basename(token), cwd);
  if (byName) return byName;

  return null;
}

/**
 * Read specific lines from a file (1-indexed, inclusive).
 * Returns the lines and the actual range read.
 */
function readLines(
  filePath: string,
  startLine: number,
  endLine: number,
): { content: string; actualStart: number; actualEnd: number; totalLines: number } {
  const raw = readFileSync(filePath, 'utf-8');
  const allLines = raw.split('\n');
  const total = allLines.length;

  const s = Math.max(1, startLine);
  const e = Math.min(total, endLine);

  const selected = allLines.slice(s - 1, e);
  return { content: selected.join('\n'), actualStart: s, actualEnd: e, totalLines: total };
}

/**
 * Parse all @file references in a message and resolve them to file content.
 *
 * @param message  The raw user input from InputBox
 * @param cwd      Working directory for resolving relative paths (default: process.cwd())
 */
export function parseFileRefs(message: string, cwd: string = process.cwd()): ParseResult {
  const refs: FileReference[] = [];
  const failedRefs: string[] = [];
  let cleanMessage = message;

  const matches = [...message.matchAll(REF_PATTERN)];

  for (const match of matches) {
    const [raw, filePart, startStr, endStr] = [match[0], match[1], match[2], match[3]] as [string, string, string | undefined, string | undefined];

    const resolved = resolveFilePath(filePart!, cwd);
    if (!resolved) {
      failedRefs.push(raw);
      continue;
    }

    let stat;
    try { stat = statSync(resolved); } catch { failedRefs.push(raw); continue; }
    if (stat.isDirectory()) { failedRefs.push(raw); continue; }

    const rawContent = readFileSync(resolved, 'utf-8');
    const totalLines = rawContent.split('\n').length;

    const startLine = startStr ? parseInt(startStr, 10) : 1;
    const endLine   = endStr   ? parseInt(endStr, 10)   : (startStr ? startLine : totalLines);

    const { content, actualStart, actualEnd } = readLines(resolved, startLine, endLine);

    const displayPath = resolved.startsWith(cwd)
      ? resolved.slice(cwd.length + 1)
      : resolved;

    refs.push({
      raw,
      resolvedPath: resolved,
      displayPath,
      startLine: actualStart,
      endLine: actualEnd,
      totalLines,
      content,
    });

    // Strip the @ref token from the clean message
    cleanMessage = cleanMessage.replace(raw, '').trim();
  }

  // Build the augmented prompt: context blocks come first, then the user's request
  const contextBlocks = refs.map((ref) => {
    const lineLabel = ref.startLine === ref.endLine
      ? `line ${ref.startLine}`
      : `lines ${ref.startLine}–${ref.endLine}`;
    return `<file path="${ref.displayPath}" ${lineLabel} of ${ref.totalLines}>\n${ref.content}\n</file>`;
  });

  const augmentedPrompt = contextBlocks.length > 0
    ? `${contextBlocks.join('\n\n')}\n\n${cleanMessage}`
    : cleanMessage;

  return { cleanMessage, refs, failedRefs, augmentedPrompt };
}

/**
 * Summary string for display in the InputBox, e.g.:
 *  "📎 bash.ts:10–25 · pruner.ts (full)"
 */
export function formatRefsSummary(refs: FileReference[]): string {
  if (refs.length === 0) return '';
  return '📎 ' + refs.map((r) => {
    const name = r.displayPath.split('/').pop()!;
    if (r.startLine === 1 && r.endLine === r.totalLines) {
      return `${name} (full)`;
    }
    return `${name}:${r.startLine}–${r.endLine}`;
  }).join(' · ');
}
