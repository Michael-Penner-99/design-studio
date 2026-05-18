/**
 * Run ID format from docs/queue-contract.md:
 *   run-{YYYYMMDD}-{HHMMSS}-{4-char-random}
 *
 * The timestamp portion is UTC so it sorts correctly in the queue/ directory.
 */
export function generateRunId(now: Date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const y = now.getUTCFullYear();
  const mo = pad(now.getUTCMonth() + 1);
  const d = pad(now.getUTCDate());
  const h = pad(now.getUTCHours());
  const mi = pad(now.getUTCMinutes());
  const s = pad(now.getUTCSeconds());

  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let rand = "";
  for (let i = 0; i < 4; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }

  return `run-${y}${mo}${d}-${h}${mi}${s}-${rand}`;
}
