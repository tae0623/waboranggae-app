/** No queue: optional AI fails fast when busy instead of blocking primary APIs. */
export class OptionalServiceGate {
  private active = 0;
  private failures = 0;
  private blockedUntil = 0;
  constructor(private maxConcurrent = 1, private cooldownMs = 30000) {}
  acquire(now = Date.now()) {
    if (this.active >= this.maxConcurrent || now < this.blockedUntil) return false;
    this.active++; return true;
  }
  release(ok: boolean, now = Date.now()) {
    this.active = Math.max(0, this.active - 1);
    this.failures = ok ? 0 : this.failures + 1;
    if (this.failures >= 2) this.blockedUntil = now + this.cooldownMs;
  }
}
