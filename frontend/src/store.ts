import type { AnalysisResult } from "./types/analysis";

/**
 * Session-only result cache.
 *
 * The MVP has no persistent storage or history, so results live in
 * memory keyed by analysis id. This lets the Results page survive
 * router navigation (and browser back/forward) within the session.
 */
const cache = new Map<string, AnalysisResult>();

export function cacheResult(result: AnalysisResult): void {
  cache.set(result.id, result);
}

export function getCachedResult(id: string): AnalysisResult | undefined {
  return cache.get(id);
}
