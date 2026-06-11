// ─── File Watcher — cache invalidation on file changes ───────────────────────

import { watch } from 'node:fs';
import { join, relative } from 'node:path';
import { dualCache } from '../cache/index.ts';
import { invalidateDepGraph } from '../context/depMapper.ts';

let _watcher: ReturnType<typeof watch> | null = null;

/**
 * Watch project root for changes and invalidate exact cache entries.
 * Ignores dotfiles and node_modules.
 */
export function startFileWatcher(projectRoot: string, onChange?: (file: string) => void): void {
  if (_watcher) return;

  try {
    _watcher = watch(projectRoot, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const rel = relative(projectRoot, join(projectRoot, filename.toString()));
      if (rel.includes('node_modules') || rel.startsWith('.')) return;

      dualCache.invalidateForFile(rel);
      invalidateDepGraph();
      onChange?.(rel);
    });
  } catch {
    // fs.watch recursive may fail on some platforms — degrade silently
  }
}

export function stopFileWatcher(): void {
  _watcher?.close();
  _watcher = null;
}
