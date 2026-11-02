/* ==========================================================================
   Registry of in-progress saves (essay editors register a flush function)
   so signing out can write pending edits before the session ends.
   ========================================================================== */

type Flusher = () => Promise<boolean>;

const flushers = new Set<Flusher>();

/** Register a flush function. Returns an unregister function. */
export function registerPendingSave(flush: Flusher): () => void {
  flushers.add(flush);
  return () => {
    flushers.delete(flush);
  };
}

/** Run every registered flush. Resolves true only if all of them saved. */
export async function flushPendingSaves(): Promise<boolean> {
  const results = await Promise.all([...flushers].map((flush) => flush().catch(() => false)));
  return results.every(Boolean);
}
