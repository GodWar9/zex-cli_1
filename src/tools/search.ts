// ─── Search Tool ─────────────────────────────────────────────────────────────
// Searches files in a directory for a text pattern (like grep).
// The agent calls this to find: where a function is defined, which file
// handles auth, where a variable is used — without the user needing to know.
//
// Two modes:
//   1. text  — plain substring search (default, case-insensitive)
//   2. regex — full regular expression (when is_regex: true)

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import type { ToolDefinition, ToolResult } from './types.ts';

const ALWAYS_IGNORE = new Set([
  'node_modules', '.git', '.svn', 'dist', 'build', 'out',
  '.next', '.nuxt', '__pycache__', 'venv', '.venv', 'coverage',
  '.turbo', 'vendor', 'target',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
  '.mp4', '.mov', '.mp3', '.wav', '.zip', '.tar', '.gz',
  '.wasm', '.lock', '.map',
]);

const MAX_RESULTS = 50;
const MAX_FILE_SIZE_BYTES = 500_000; // skip files over 500 KB

interface SearchMatch {
  file: string;
  line: number;
  content: string;
}

function searchFile(
  filePath: string,
  rootPath: string,
  pattern: RegExp,
  results: SearchMatch[],
): void {
  if (results.length >= MAX_RESULTS) return;

  let stat;
  try { stat = statSync(filePath); } catch { return; }
  if (stat.size > MAX_FILE_SIZE_BYTES) return;

  let text: string;
  try { text = readFileSync(filePath, 'utf-8'); } catch { return; }

  const lines = text.split('\n');
  for (let i = 0; i < lines.length && results.length < MAX_RESULTS; i++) {
    if (pattern.test(lines[i]!)) {
      results.push({
        file: relative(rootPath, filePath),
        line: i + 1,
        content: lines[i]!.trim().slice(0, 200), // trim + cap length
      });
    }
  }
}

function walkSearch(
  dirPath: string,
  rootPath: string,
  pattern: RegExp,
  results: SearchMatch[],
  includeExts?: Set<string>,
): void {
  if (results.length >= MAX_RESULTS) return;

  let items: string[];
  try { items = readdirSync(dirPath); } catch { return; }

  for (const item of items) {
    if (results.length >= MAX_RESULTS) break;
    if (item.startsWith('.') && item !== '.env') continue;
    if (ALWAYS_IGNORE.has(item)) continue;

    const fullPath = join(dirPath, item);
    let stat;
    try { stat = statSync(fullPath); } catch { continue; }

    if (stat.isDirectory()) {
      walkSearch(fullPath, rootPath, pattern, results, includeExts);
    } else {
      const ext = extname(item).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) continue;
      if (includeExts && includeExts.size > 0 && !includeExts.has(ext)) continue;
      searchFile(fullPath, rootPath, pattern, results);
    }
  }
}

function formatResults(results: SearchMatch[], query: string, path: string): string {
  if (results.length === 0) {
    return `No matches found for "${query}" in ${path}`;
  }

  const lines: string[] = [
    `Found ${results.length} match${results.length !== 1 ? 'es' : ''} for "${query}" in ${path}:`,
    '',
  ];

  let currentFile = '';
  for (const r of results) {
    if (r.file !== currentFile) {
      currentFile = r.file;
      lines.push(`  📄 ${r.file}`);
    }
    lines.push(`    L${r.line}: ${r.content}`);
  }

  if (results.length >= MAX_RESULTS) {
    lines.push('', `⚠ Results capped at ${MAX_RESULTS}. Narrow your search with a more specific query or file_types.`);
  }

  return lines.join('\n');
}

export const searchTool: ToolDefinition = {
  name: 'search_files',
  description: `Searches files in a directory for a text pattern (like grep).
Use this to find: where a function or variable is defined, which file handles a feature, where something is imported, etc.
You do NOT need to ask the user "which file?" — just search for it.
Returns matching file paths and line numbers with surrounding context.`,

  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The text or pattern to search for.',
      },
      path: {
        type: 'string',
        description: 'Directory to search in. Defaults to current working directory.',
      },
      is_regex: {
        type: 'boolean',
        description: 'If true, treats query as a regular expression. Default is false (plain text search).',
      },
      case_sensitive: {
        type: 'boolean',
        description: 'If true, search is case-sensitive. Default is false.',
      },
      file_types: {
        type: 'string',
        description: 'Comma-separated list of file extensions to limit search to (e.g. ".ts,.tsx,.js"). Default: all text files.',
      },
    },
    required: ['query'],
  },

  async execute({
    query,
    path: dirPath,
    is_regex = false,
    case_sensitive = false,
    file_types,
  }: {
    query: string;
    path?: string;
    is_regex?: boolean;
    case_sensitive?: boolean;
    file_types?: string;
  }): Promise<ToolResult> {
    const targetPath = dirPath ?? process.cwd();

    if (!existsSync(targetPath)) {
      return { content: `Error: Path not found: ${targetPath}`, isError: true };
    }

    // Build regex
    let pattern: RegExp;
    try {
      const flags = case_sensitive ? 'g' : 'gi';
      pattern = is_regex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    } catch (e: any) {
      return { content: `Error: Invalid regex pattern: ${e.message}`, isError: true };
    }

    // Optional extension filter
    let includeExts: Set<string> | undefined;
    if (file_types) {
      includeExts = new Set(
        file_types.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
      );
    }

    const results: SearchMatch[] = [];

    const stat = statSync(targetPath);
    if (stat.isFile()) {
      searchFile(targetPath, targetPath, pattern, results);
    } else {
      walkSearch(targetPath, targetPath, pattern, results, includeExts);
    }

    return {
      content: formatResults(results, query, targetPath),
      structuredData: results, // zex: added for toon-encoding — uniform {file,line,content}[]
    };
  },
};
