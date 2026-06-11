// ─── Undo Stack ───────────────────────────────────────────────────────────────
// Tracks every write_file call made by the agent this session.
// /undo reverts the most recent write by restoring the previous content.
// Holds at most MAX_UNDO_DEPTH entries — oldest are dropped when full.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const MAX_UNDO_DEPTH = 20;

export interface UndoEntry {
  filePath: string;
  previousContent: string | null; // null = file didn't exist before (undo = delete)
  newContent: string;
  timestamp: number;
  toolName: string; // e.g. 'write_file'
}

class UndoStack {
  private stack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];

  /**
   * Call this BEFORE a file write happens to snapshot the previous state.
   * Returns the entry (push it after confirming the write succeeded).
   */
  snapshot(filePath: string, toolName: string): UndoEntry {
    let previousContent: string | null = null;
    if (existsSync(filePath)) {
      try {
        previousContent = readFileSync(filePath, 'utf-8');
      } catch {
        previousContent = null;
      }
    }
    return { filePath, previousContent, newContent: '', timestamp: Date.now(), toolName };
  }

  /**
   * Commit an entry after the write succeeded.
   * Read the new content from disk and push to stack.
   */
  commit(entry: UndoEntry): void {
    try {
      entry.newContent = readFileSync(entry.filePath, 'utf-8');
    } catch {
      entry.newContent = '';
    }
    this.stack.push(entry);
    this.redoStack = []; // new write clears redo history
    if (this.stack.length > MAX_UNDO_DEPTH) {
      this.stack.shift(); // drop oldest
    }
  }

  /**
   * Undo the most recent write. Returns a description of what was reverted,
   * or null if the stack is empty.
   */
  undo(): string | null {
    const entry = this.stack.pop();
    if (!entry) return null;

    try {
      // Snapshot current state for redo before reverting
      let currentContent: string | null = null;
      if (existsSync(entry.filePath)) {
        currentContent = readFileSync(entry.filePath, 'utf-8');
      }
      this.redoStack.push({ ...entry, previousContent: currentContent, newContent: entry.newContent });

      if (entry.previousContent === null) {
        const { unlinkSync } = require('node:fs');
        unlinkSync(entry.filePath);
        return `Deleted ${entry.filePath} (it was created by the agent)`;
      } else {
        writeFileSync(entry.filePath, entry.previousContent, 'utf-8');
        return `Restored ${entry.filePath} to its state before the last ${entry.toolName}`;
      }
    } catch (e: any) {
      return `Failed to undo ${entry.filePath}: ${e.message}`;
    }
  }

  redo(): string | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;

    try {
      if (entry.previousContent === null && !existsSync(entry.filePath)) {
        writeFileSync(entry.filePath, entry.newContent, 'utf-8');
      } else {
        writeFileSync(entry.filePath, entry.newContent, 'utf-8');
      }
      this.stack.push(entry);
      return `Redid ${entry.toolName} on ${entry.filePath}`;
    } catch (e: any) {
      return `Failed to redo ${entry.filePath}: ${e.message}`;
    }
  }

  get redoDepth(): number {
    return this.redoStack.length;
  }

  /** Number of undoable operations in the stack */
  get depth(): number {
    return this.stack.length;
  }

  /** Peek at what /undo will revert (without doing it) */
  peekDescription(): string | null {
    const entry = this.stack[this.stack.length - 1];
    if (!entry) return null;
    const file = entry.filePath.split('/').pop();
    const age = Math.round((Date.now() - entry.timestamp) / 1000);
    return `${file} (${age}s ago via ${entry.toolName})`;
  }
}

// Singleton — shared across the session
export const undoStack = new UndoStack();
