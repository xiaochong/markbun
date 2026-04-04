import { AI_MODELS } from './ai-models-data';

/**
 * Returns model ID strings for a given MarkBun provider.
 * Data sourced from @mariozechner/pi-ai via scripts/generate-ai-models.ts
 */
export function getModelIds(providerId: string): string[] {
  return AI_MODELS[providerId] ?? [];
}
