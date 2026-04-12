/**
 * AI Keys Service — Secure API key storage for AI providers
 *
 * Keys stored in ~/.config/markbun/ai-keys.json with 0600 permissions.
 * Never sent to WebView — only masked identifiers returned via RPC.
 */

import { readFile, writeFile, access, mkdir, chmod } from 'fs/promises';
import { join } from 'path';
import { homedir } from './homedir';

const CONFIG_DIR = join(homedir(), '.config', 'markbun');
const AI_KEYS_PATH = join(CONFIG_DIR, 'ai-keys.json');

export interface AIKeyEntry {
  provider: string;
  apiKey: string;
}

export interface AIKeysFile {
  keys: Record<string, string>; // provider -> apiKey
}

async function ensureConfigDir(): Promise<void> {
  try {
    await access(CONFIG_DIR);
  } catch {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load all API keys from disk
 */
export async function loadAIKeys(): Promise<Record<string, string>> {
  try {
    const data = await readFile(AI_KEYS_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed.keys === 'object') {
      return parsed.keys as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Save API key for a provider
 */
export async function saveAIKey(provider: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureConfigDir();
    const keys = await loadAIKeys();
    keys[provider] = apiKey;
    await writeFile(AI_KEYS_PATH, JSON.stringify({ keys }, null, 2), 'utf-8');
    await chmod(AI_KEYS_PATH, 0o600);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get API key for a specific provider
 */
export async function getAIKey(provider: string): Promise<string | null> {
  const keys = await loadAIKeys();
  return keys[provider] ?? null;
}

/**
 * Delete API key for a provider
 */
export async function deleteAIKey(provider: string): Promise<{ success: boolean; error?: string }> {
  try {
    const keys = await loadAIKeys();
    if (!(provider in keys)) {
      return { success: true };
    }
    delete keys[provider];
    await writeFile(AI_KEYS_PATH, JSON.stringify({ keys }, null, 2), 'utf-8');
    await chmod(AI_KEYS_PATH, 0o600);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Mask an API key for safe display in UI (e.g., "sk-...xxxx")
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '***';
  return key.slice(0, 3) + '...' + key.slice(-4);
}

/**
 * Get masked API keys for all providers (for RPC responses)
 */
export async function getMaskedKeys(): Promise<Record<string, string>> {
  const keys = await loadAIKeys();
  const masked: Record<string, string> = {};
  for (const [provider, key] of Object.entries(keys)) {
    masked[provider] = maskApiKey(key);
  }
  return masked;
}
