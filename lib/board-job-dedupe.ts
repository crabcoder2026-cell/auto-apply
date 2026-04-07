/**
 * Canonical Greenhouse job identity for deduplication across
 * boards.greenhouse.io vs job-boards.greenhouse.io URLs and casing.
 */
export function stableBoardJobKey(
  boardToken: string,
  jobId: string | number
): string {
  return `${boardToken.toLowerCase()}:${String(jobId)}`;
}

/** Normalize keys loaded from watch config (fixes legacy mixed-case tokens). */
export function normalizeStoredBoardJobKey(key: string): string {
  const m = key.trim().match(/^([\w-]+):(\d+)$/);
  if (!m) return key.trim();
  return stableBoardJobKey(m[1], m[2]);
}
