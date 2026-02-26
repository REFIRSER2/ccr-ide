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
}
