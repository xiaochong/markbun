// AI Session History Service — Persist AI conversation sessions across restarts
//
// Stores sessions in ~/.config/markbun/ai-sessions/
//   index.json         — array of session metadata (sorted newest-first)
//   <sessionId>.json   — full session data (messages + metadata)
// Max 50 sessions; oldest auto-deleted on overflow.

import { readFile, writeFile, access, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

// Re-use the frontend AIMessage shape (subset needed for persistence)
export interface AIMessageSnapshot {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  error?: string;
  toolName?: string;
  toolResult?: unknown;
  toolArgs?: Record<string, unknown>;
  status?: 'executing' | 'success' | 'failed' | 'timeout';
  startTime?: number;
  duration?: number;
}

export interface AISessionSummary {
  id: string;
  title: string;
  model: string;
  filePath: string | null;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface AISession extends AISessionSummary {
  messages: AIMessageSnapshot[];
}

const CONFIG_DIR = join(homedir(), '.config', 'markbun');
const SESSIONS_DIR = join(CONFIG_DIR, 'ai-sessions');
const INDEX_PATH = join(SESSIONS_DIR, 'index.json');
const MAX_SESSIONS = 50;

async function ensureDir(): Promise<void> {
  try {
    await access(SESSIONS_DIR);
  } catch {
    await mkdir(SESSIONS_DIR, { recursive: true });
  }
}

function sessionPath(id: string): string {
  return join(SESSIONS_DIR, `${id}.json`);
}

function generateTitle(messages: AIMessageSnapshot[]): string {
  const first = messages.find(m => m.role === 'user');
  if (!first) return 'Untitled Session';
  const text = first.content.trim();
  return text.length > 40 ? text.substring(0, 40) + '...' : text;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load session index (metadata only, sorted newest-first).
 */
export async function loadSessionIndex(): Promise<{ success: boolean; sessions?: AISessionSummary[]; error?: string }> {
  try {
    await ensureDir();
    const data = await readFile(INDEX_PATH, 'utf-8');
    if (!data.trim()) return { success: true, sessions: [] };
    const sessions = JSON.parse(data) as AISessionSummary[];
    return { success: true, sessions };
  } catch {
    return { success: true, sessions: [] };
  }
}

/**
 * Save a session (create or update).
 * Writes the full session file and updates the index.
 */
export async function saveSession(session: AISession): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDir();

    // Write session file
    await writeFile(sessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');

    // Update index
    let index: AISessionSummary[] = [];
    try {
      const data = await readFile(INDEX_PATH, 'utf-8');
      if (data.trim()) index = JSON.parse(data) as AISessionSummary[];
    } catch {
      // First session
    }

    const summary: AISessionSummary = {
      id: session.id,
      title: session.title,
      model: session.model,
      filePath: session.filePath,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messageCount,
    };

    // Replace existing or prepend
    const filtered = index.filter(s => s.id !== session.id);
    filtered.unshift(summary);

    // Trim oldest if over max
    const trimmed = filtered.slice(0, MAX_SESSIONS);

    await writeFile(INDEX_PATH, JSON.stringify(trimmed, null, 2), 'utf-8');

    // Delete orphaned session files
    if (trimmed.length < filtered.length) {
      const removed = filtered.slice(MAX_SESSIONS);
      for (const s of removed) {
        try { await unlink(sessionPath(s.id)); } catch { /* ignore */ }
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Load a full session by ID.
 */
export async function loadSession(id: string): Promise<{ success: boolean; session?: AISession; error?: string }> {
  try {
    await ensureDir();
    const data = await readFile(sessionPath(id), 'utf-8');
    if (!data.trim()) return { success: false, error: 'Session not found' };
    const session = JSON.parse(data) as AISession;
    return { success: true, session };
  } catch {
    return { success: false, error: 'Session not found' };
  }
}

/**
 * Delete a session by ID.
 */
export async function deleteSession(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDir();

    // Remove session file
    try { await unlink(sessionPath(id)); } catch { /* ignore if already gone */ }

    // Update index
    let index: AISessionSummary[] = [];
    try {
      const data = await readFile(INDEX_PATH, 'utf-8');
      if (data.trim()) index = JSON.parse(data) as AISessionSummary[];
    } catch { /* ignore */ }

    const filtered = index.filter(s => s.id !== id);
    await writeFile(INDEX_PATH, JSON.stringify(filtered, null, 2), 'utf-8');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get the most recent session (for auto-restore).
 */
export async function getLatestSession(): Promise<{ success: boolean; session?: AISession; error?: string }> {
  const result = await loadSessionIndex();
  if (!result.success || !result.sessions || result.sessions.length === 0) {
    return { success: true };
  }
  return loadSession(result.sessions[0].id);
}

/**
 * Create a new empty session with a generated ID.
 */
export function createNewSession(model: string, filePath: string | null): AISession {
  const now = Date.now();
  return {
    id: randomUUID(),
    title: 'Untitled Session',
    model,
    filePath,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    messages: [],
  };
}

/**
 * Update title from messages if still "Untitled Session".
 */
export function updateSessionTitle(session: AISession): AISession {
  if (session.title === 'Untitled Session' && session.messages.length > 0) {
    return { ...session, title: generateTitle(session.messages) };
  }
  return session;
}
