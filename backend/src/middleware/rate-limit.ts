type Bucket = { count: number; resetAt: number; inFlight: number; lastSeen: number };

export class IpRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly max: number, private readonly windowMs: number, private readonly burst: number) {}

  enter(ip: string, now = Date.now()): { allowed: true; release: () => void } | { allowed: false; retryAfterSeconds: number } {
    this.prune(now);
    let bucket = this.buckets.get(ip);
    if (!bucket || now >= bucket.resetAt) bucket = { count: 0, resetAt: now + this.windowMs, inFlight: 0, lastSeen: now };
    bucket.lastSeen = now;
    if (bucket.count >= this.max || bucket.inFlight >= this.burst) {
      this.buckets.set(ip, bucket);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
    }
    bucket.count += 1; bucket.inFlight += 1; this.buckets.set(ip, bucket);
    let released = false;
    return { allowed: true, release: () => { if (!released) { released = true; bucket!.inFlight = Math.max(0, bucket!.inFlight - 1); } } };
  }

  private prune(now: number) {
    if (this.buckets.size < 1_000) return;
    for (const [ip, bucket] of this.buckets) if (now - bucket.lastSeen > this.windowMs * 2) this.buckets.delete(ip);
  }
}
