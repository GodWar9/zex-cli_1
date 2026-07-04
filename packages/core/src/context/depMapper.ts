// ─── Code Dependency Mapper ───────────────────────────────────────────────────
// Builds import graph on demand; used by pruner to include critical-path files.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const IMPORT_RE = /(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

let _graph: Map<string, Set<string>> | null = null;
let _root: string | null = null;

function resolveImport(fromFile: string, spec: string, root: string): string | null {
  if (spec.startsWith('.')) {
    const base = join(root, fromFile, '..', spec);
    for (const ext of ['', ...CODE_EXTS]) {
      const candidate = base + ext;
      if (existsSync(candidate)) return relative(root, candidate).replace(/\\/g, '/');
    }
    for (const ext of CODE_EXTS) {
      const candidate = join(base, 'index' + ext);
      if (existsSync(candidate)) return relative(root, candidate).replace(/\\/g, '/');
    }
  }
  return null;
}

function collectFiles(dir: string, root: string, out: string[]): void {
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) collectFiles(full, root, out);
      else if (CODE_EXTS.has(extname(entry))) out.push(relative(root, full).replace(/\\/g, '/'));
    }
  } catch { /* skip unreadable dirs */ }
}

/** Build or return cached dependency graph: file → imported local files */
export function buildDepGraph(projectRoot: string): Map<string, Set<string>> {
  if (_graph && _root === projectRoot) return _graph;

  const graph = new Map<string, Set<string>>();
  const files: string[] = [];
  collectFiles(projectRoot, projectRoot, files);

  for (const file of files) {
    const deps = new Set<string>();
    try {
      const content = readFileSync(join(projectRoot, file), 'utf-8');
      for (const m of content.matchAll(IMPORT_RE)) {
        const spec = m[1] ?? m[2];
        if (!spec) continue;
        const resolved = resolveImport(file, spec, projectRoot);
        if (resolved) deps.add(resolved);
      }
    } catch { /* skip */ }
    graph.set(file, deps);
  }

  _graph = graph;
  _root = projectRoot;
  return graph;
}

/** BFS: get files within `depth` hops from target */
export function getCriticalPath(targetFile: string, depth = 2, projectRoot = process.cwd()): string[] {
  const graph = buildDepGraph(projectRoot);
  const visited = new Set<string>();
  const queue: Array<{ file: string; d: number }> = [{ file: targetFile, d: 0 }];
  const result: string[] = [];

  while (queue.length > 0) {
    const { file, d } = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);
    result.push(file);
    if (d >= depth) continue;
    const deps = graph.get(file);
    if (deps) {
      for (const dep of deps) queue.push({ file: dep, d: d + 1 });
    }
    // Reverse: files that import this file
    for (const [f, deps] of graph.entries()) {
      if (deps.has(file)) queue.push({ file: f, d: d + 1 });
    }
  }
  return result;
}

export function invalidateDepGraph(): void {
  _graph = null;
  _root = null;
}
