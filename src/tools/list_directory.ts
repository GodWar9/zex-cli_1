// ─── List Directory Tool ──────────────────────────────────────────────────────
// Recursively lists files and folders in a directory.
// Returns a clean tree-style output the model can read to understand
// the full project layout WITHOUT the user having to explain anything.
//
// The agent should call this automatically at the start of any task
// to get "situational awareness" of the project.

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { ToolDefinition, ToolResult } from './types.ts';

// Folders that are never interesting to the model — skip them always
const ALWAYS_IGNORE = new Set([
  'node_modules', '.git', '.svn', '.hg',
  'dist', 'build', 'out', '.next', '.nuxt',
  '__pycache__', '.pytest_cache', '.mypy_cache',
  'venv', '.venv', 'env',
  '.cache', 'coverage', '.turbo',
  'vendor', 'target', // Rust/PHP
]);

// File extensions to skip — binary/lock/generated
const IGNORE_EXTENSIONS = new Set([
  '.lock', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
  '.mp4', '.mov', '.mp3', '.wav',
  '.zip', '.tar', '.gz',
  '.wasm', '.min.js', '.min.css',
  '.map', // source maps
]);

const MAX_DEPTH = 6;    // Don't recurse past this depth
const MAX_ENTRIES = 300; // Stop listing if tree gets too large

interface Entry {
  path: string;
  type: 'file' | 'dir';
  children?: Entry[];
}

function walk(dirPath: string, depth: number, rootPath: string, count: { n: number }): Entry[] {
  if (depth > MAX_DEPTH || count.n >= MAX_ENTRIES) return [];

  let items: string[];
  try {
    items = readdirSync(dirPath).sort();
  } catch {
    return [];
  }

  const entries: Entry[] = [];

  for (const item of items) {
    if (count.n >= MAX_ENTRIES) break;
    if (item.startsWith('.') && item !== '.env') continue; // skip hidden except .env
    if (ALWAYS_IGNORE.has(item)) continue;

    const ext = '.' + item.split('.').pop()!;
    if (IGNORE_EXTENSIONS.has(ext)) continue;

    const fullPath = join(dirPath, item);
    const relPath = relative(rootPath, fullPath);

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    count.n++;

    if (stat.isDirectory()) {
      const children = walk(fullPath, depth + 1, rootPath, count);
      entries.push({ path: relPath, type: 'dir', children });
    } else {
      entries.push({ path: relPath, type: 'file' });
    }
  }

  return entries;
}

function renderTree(entries: Entry[], prefix = ''): string {
  const lines: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';
    const name = entry.path.split('/').pop()!;
    const icon = entry.type === 'dir' ? '📁' : '📄';
    lines.push(`${prefix}${connector}${icon} ${name}`);
    if (entry.type === 'dir' && entry.children && entry.children.length > 0) {
      lines.push(renderTree(entry.children, prefix + childPrefix));
    }
  }
  return lines.join('\n');
}

export const listDirectoryTool: ToolDefinition = {
  name: 'list_directory',
  description: `Lists files and folders in a directory recursively, returned as a readable tree.
Use this at the START of any task where you need to understand the project structure.
You do NOT need to ask the user for their file layout — just call this tool with the working directory.
Skips node_modules, .git, build artifacts, and binary files automatically.`,

  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory to list. Defaults to current working directory if omitted.',
      },
      max_depth: {
        type: 'number',
        description: 'How many levels deep to recurse (1–6). Default is 4.',
      },
    },
    required: [],
  },

  async execute({ path: dirPath, max_depth }: { path?: string; max_depth?: number }): Promise<ToolResult> {
    const targetPath = dirPath ?? process.cwd();
    const depth = Math.min(Math.max(max_depth ?? 4, 1), MAX_DEPTH);

    if (!existsSync(targetPath)) {
      return {
        content: `Error: Directory not found: ${targetPath}`,
        isError: true,
      };
    }

    const count = { n: 0 };
    const entries = walk(targetPath, 0, targetPath, count);
    const tree = renderTree(entries);

    const truncatedNote = count.n >= MAX_ENTRIES
      ? `\n\n⚠ Output truncated at ${MAX_ENTRIES} entries. Use a more specific path to see deeper.`
      : '';

    const output = `Project structure: ${targetPath}\n\n${tree || '(empty directory)'}${truncatedNote}\n\nTotal: ${count.n} items shown`;

    // zex: added for toon-encoding — flatten the entry tree into a uniform array
    const flatEntries = flattenEntries(entries);

    return {
      content: output,
      structuredData: flatEntries,
    };
  },
};

/** Flatten the nested Entry tree into a uniform array for TOON encoding. */
function flattenEntries(entries: Entry[], result: Array<{ path: string; type: string }> = []): Array<{ path: string; type: string }> {
  for (const e of entries) {
    result.push({ path: e.path, type: e.type });
    if (e.children && e.children.length > 0) {
      flattenEntries(e.children, result);
    }
  }
  return result;
}

