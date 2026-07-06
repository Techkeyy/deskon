// Per-instance sliding-window rate limiter (globalThis-backed).
// Serverless caveat: each instance keeps its own window, so the effective
// global limit is (limit × instances). Real friction, not a hard wall —
// swap for Upstash/Redis when traffic justifies it.

const g = globalThis as unknown as {
  __deskonRates?: Map<string, number[]>;
};
const hits: Map<string, number[]> =
  g.__deskonRates ?? (g.__deskonRates = new Map());

/** Returns true if the call is allowed, false if the key is over limit. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  const stamps = (hits.get(key) ?? []).filter((t) => t > windowStart);
  if (stamps.length >= limit) {
    hits.set(key, stamps);
    return false;
  }
  stamps.push(now);
  hits.set(key, stamps);
  return true;
}

/** Client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: { headers: Headers }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
