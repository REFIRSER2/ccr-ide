/**
 * Ring buffer for storing scrollback data.
 * When the buffer exceeds maxBytes, oldest chunks are dropped.
 */
export class RingBuffer {
  private chunks: Buffer[] = [];
  private totalBytes = 0;
  private readonly maxBytes: number;

  constructor(maxBytes: number) {
    this.maxBytes = maxBytes;
  }

  push(data: Buffer | string): void {
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    this.chunks.push(buf);
    this.totalBytes += buf.length;

    while (this.totalBytes > this.maxBytes && this.chunks.length > 1) {
      const removed = this.chunks.shift()!;
      this.totalBytes -= removed.length;
    }
  }

  getAll(): Buffer {
    return Buffer.concat(this.chunks);
  }

  clear(): void {
    this.chunks = [];
    this.totalBytes = 0;
  }

  get size(): number {
    return this.totalBytes;
  }

  get isEmpty(): boolean {
    return this.totalBytes === 0;
  }

  /**
   * Returns serializable data for session persistence.
   * Each chunk is converted to a base64 string.
   */
  toJSON(): { chunks: string[]; maxBytes: number } {
    return {
      chunks: this.chunks.map((c) => c.toString('base64')),
      maxBytes: this.maxBytes,
    };
  }

  /**
   * Restore a RingBuffer from previously saved chunks.
   * @param chunks - Array of Buffer instances to restore from
   * @param maxBytes - Optional max size; defaults to the sum of all chunk sizes if not provided
   */
  static fromChunks(chunks: Buffer[], maxBytes?: number): RingBuffer {
    const totalBytes = chunks.reduce((sum, c) => sum + c.length, 0);
    const rb = new RingBuffer(maxBytes ?? totalBytes);
    for (const chunk of chunks) {
      rb.push(chunk);
    }
    return rb;
  }
}
