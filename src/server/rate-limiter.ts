/**
 * Simple sliding-window rate limiter for WebSocket messages.
 */
export class RateLimiter {
  private windows = new Map<string, number[]>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if a request from the given key is allowed.
   * Returns true if allowed, false if rate-limited.
   */
  check(key: string): boolean {
    const now = Date.now();
    const timestamps = this.windows.get(key) ?? [];

    // Remove timestamps outside the window
    const windowStart = now - this.windowMs;
    const filtered = timestamps.filter(t => t > windowStart);

    if (filtered.length >= this.maxRequests) {
      this.windows.set(key, filtered);
      return false;
    }

    filtered.push(now);
    this.windows.set(key, filtered);
    return true;
  }

  /**
   * Remove tracking for a key (e.g., on disconnect).
   */
  remove(key: string): void {
    this.windows.delete(key);
  }

  /**
   * Clean up stale entries.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.windows) {
      const filtered = timestamps.filter(t => t > now - this.windowMs);
      if (filtered.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, filtered);
      }
    }
  }
}
