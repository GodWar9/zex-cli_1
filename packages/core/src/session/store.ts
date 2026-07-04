// ─── Session Store ────────────────────────────────────────────────────────────
// Saves and loads conversation history to ~/.zex/sessions/
// Automatically saves the current state after every turn.

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ConversationMessage } from '../agent/types.ts';

const SESSIONS_DIR = join(homedir(), '.zex', 'sessions');

interface SessionMetadata {
  id: string;
  timestamp: number;
  messageCount: number;
  preview: string;
}

function ensureDir() {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

/**
 * Save the conversation to a JSON file.
 * The ID is usually derived from the start time, e.g., '2023-10-25-14-30-00'.
 */
export function saveSession(id: string, messages: ConversationMessage[]): void {
  // Don't save empty sessions
  if (messages.length <= 1 && messages[0]?.role === 'system') return;
  if (messages.length === 0) return;

  ensureDir();
  const filePath = join(SESSIONS_DIR, `${id}.json`);
  
  const data = JSON.stringify({
    id,
    timestamp: Date.now(),
    messages,
  }, null, 2);

  try {
    writeFileSync(filePath, data, 'utf-8');
  } catch (e) {
    // Ignore save errors to not interrupt the user
  }
}

/**
 * Load the most recent session from disk.
 */
export function loadLastSession(): ConversationMessage[] | null {
  ensureDir();
  try {
    const files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
    if (files.length === 0) return null;

    // Sort by modification time, newest first
    files.sort((a, b) => {
      const statA = statSync(join(SESSIONS_DIR, a));
      const statB = statSync(join(SESSIONS_DIR, b));
      return statB.mtimeMs - statA.mtimeMs;
    });

    const newestFile = files[0]!;
    const raw = readFileSync(join(SESSIONS_DIR, newestFile), 'utf-8');
    const parsed = JSON.parse(raw);
    
    if (Array.isArray(parsed.messages)) {
      return parsed.messages;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Generate a new session ID based on the current timestamp.
 */
export function generateSessionId(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}-${String(d.getSeconds()).padStart(2, '0')}`;
}
